import {
	BINARY_ENCODING,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

import { basicFtpApiTest } from './BasicFtpApiTest';

import { Client } from 'basic-ftp';
import { IBasicFtpApiCredentials } from '../../credentials/BasicFtpApi.credentials';
import { Buffer } from 'buffer';
import { Readable, Writable } from 'stream';
import { basename } from 'path';


export class BasicFtp implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Basic FTP',
		name: 'basicFtp',
		icon: 'file:basicFtp.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: `Implement the operations from the "basic-ftp" library`,
		defaults: {
			name: 'BasicFtp',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'basicFtpApi',
				required: true,
				// There is an N8N issue with the test credential function. Uncomment when fixed.
				// https://community.n8n.io/t/couldn-t-connect-with-these-settings/34679/5
				// testedBy: 'basicFtpApiTest',
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete a file on the server',
					},
					{
						name: 'Download',
						value: 'download',
						action: 'Download a file from the server',
					},
					{
						name: 'List',
						value: 'list',
						action: 'List the contents of a folder',
					},
					{
						name: 'Make Directory',
						value: 'mkdir',
						action: 'Create a directory on the server',
					},
					{
						name: 'Remove Directory',
						value: 'rmdir',
						action: 'Remove a directory on the server',
					},
					{
						name: 'Upload',
						value: 'upload',
						action: 'Upload a file to the server',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Folder Path',
				name: 'folderPath',
				required: true,
				type: 'string',
				displayOptions: {
					show: {
						operation: ['list', 'mkdir', 'rmdir'],
					},
				},
				default: '',
				placeholder: '/path/to/remote/folder',
				description: 'The path to the folder on the server',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['download', 'upload'],
					},
				},
				default: 'data',
				description: 'Name of the binary property to/from which to write/read the data',
			},
			{
				displayName: 'Path',
				name: 'path',
				required: true,
				type: 'string',
				displayOptions: {
					show: {
						operation: ['delete', 'download', 'upload'],
					},
				},
				default: '',
				placeholder: '/path/to/remote/file.txt',
				description: 'The path to the file on the server',
			},
		],
	};

	methods = {
		credentialTest: {
			basicFtpApiTest,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		let returnItems: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('basicFtpApi') as unknown as IBasicFtpApiCredentials;

		const client = new Client();
		client.ftp.verbose = credentials.verboseLogging;

		// Function to replace spaces with new lines but preserve BEGIN and END markers correctly
		// Needed because n8n converts new lines to spaces if not edited as an expression in the code editor
		function formatPem(pem: string | undefined): string | undefined {
			if (!pem) return pem;
			return pem
				.replace(/(-----BEGIN [A-Z ]+-----)([\s\S]*?)(-----END [A-Z ]+-----)/g, (match, p1, p2, p3) => {
					const formattedContent = p2.replace(/ +/g, '\n');
					return `${p1}${formattedContent}${p3}`;
				});
		}

		// Format the certificate and private key
		const cert = formatPem(credentials.certificate);
		const key = formatPem(credentials.privateKey);

		// Construct the secureOptions object conditionally
		const secureOptions = {
			rejectUnauthorized: credentials.ignoreTlsIssues,
			...(cert && { cert }), // Only include cert if it exists
			...(key && { key }), // Only include key if it exists
		};

		// Connect to the FTP server
		await client.access({
			host: credentials.host,
			...(credentials.port && credentials.port !== 0 && { port: credentials.port }), // Only include port if it is provided
			user: credentials.user,
			password: credentials.password,
			secure: credentials.secure,
			secureOptions,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				switch (operation) {
					case 'delete': {
						const deleteRemotePath = this.getNodeParameter('path', i) as string;
						returnItems.push({
							json: await client.remove(deleteRemotePath) as unknown as IDataObject,
						});
						break;
					}
					case 'download': {
						const downloadPath = this.getNodeParameter('path', i) as string;
						const binaryPropertyNameDownload = this.getNodeParameter('binaryProperty', i) as string;

						// Create an array to collect chunks of data
						const chunks: Buffer[] = [];

						// Create a writable stream to collect the data into the chunks array
						const writableStream = new Writable({
							write(chunk, encoding, callback) {
								chunks.push(chunk);
								callback();
							},
						});

						// Download the file directly into the writable stream
						await client.downloadTo(writableStream, downloadPath);

						// Combine the chunks into a single buffer
						const downloadFileBuffer = Buffer.concat(chunks);

						// Prepare and store the binary data
						const fileName = basename(downloadPath);
						const binaryData = await this.helpers.prepareBinaryData(downloadFileBuffer, fileName);

						// Create an execution data object and add it to returnItems
						const newItem: INodeExecutionData = {
							json: items[i].json, // Return the input JSON data
							binary: {
								[binaryPropertyNameDownload]: binaryData, // Store the binary data under the specified property
							},
						};

						returnItems.push(newItem);
						break;
					}
					case 'list': {
						const listFolderPath = this.getNodeParameter('folderPath', i) as string;
						const responseData = await client.list(listFolderPath);

						if (responseData.length > 0) {
							// Add each listed item as a separate execution data item
							responseData.forEach((item: any) => {
								returnItems.push({ json: item });
							});
						} else {
							// If no items were listed, return success:true
							returnItems.push({ json: { success: true } });
						}
						break;
					}
					case 'mkdir': {
						const mkdirFolderPath = this.getNodeParameter('folderPath', i) as string;
						await client.ensureDir(mkdirFolderPath),
						returnItems.push({
							json: { success: true },
						});
						break;
					}
					case 'rmdir': {
						const rmdirFolderPath = this.getNodeParameter('folderPath', i) as string;
						await client.removeDir(rmdirFolderPath) as unknown as IDataObject
						returnItems.push({
							json: { success: true },
						});
						break;
					}
					case 'upload': {
						const uploadPath = this.getNodeParameter('path', i) as string;
						const binaryPropertyNameUpload = this.getNodeParameter('binaryProperty', i) as string;

						// Retrieve the binary data from the specified binary property
						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyNameUpload);

						// Convert the binary data to a buffer
						const uploadFileBuffer = Buffer.from(binaryData.data, BINARY_ENCODING);

						// Create a readable stream from the buffer
						const readableStream = new Readable();
						readableStream.push(uploadFileBuffer);
						readableStream.push(null); // Signal the end of the stream

						// Upload the buffer to the FTP server
						returnItems.push({
							json: await client.uploadFrom(readableStream, uploadPath) as unknown as IDataObject,
						});
						break;
					}
					default:
						throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported!`);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnItems.push({ json: { error: error.message }, pairedItem: i });
					continue;
				}
				throw new NodeApiError(this.getNode(), error);
			}
		}
		client.close();
		return this.prepareOutputData(returnItems);
	}
}
