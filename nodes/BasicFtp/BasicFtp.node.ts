
import {
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
						name: 'Download',
						value: 'download',
						action: 'Download a file from the server',
					},
					{
						name: 'List',
						value: 'list',
						action: 'List the contents of a folder',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Local Path',
				required: true,
				name: 'localPath',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['download'],
					},
				},
				default: '',
				placeholder: '/path/to/local/file.txt',
				description: 'The path to the file on the local machine',
			},
			{
				displayName: 'Remote Path',
				name: 'remotePath',
				required: true,
				type: 'string',
				displayOptions: {
					show: {
						operation: ['download'],
					},
				},
				default: '',
				placeholder: '/path/to/remote/file.txt',
				description: 'The path to the file on the server',
			},
			{
				displayName: 'Remote Folder Path',
				name: 'remoteFolderPath',
				required: true,
				type: 'string',
				displayOptions: {
					show: {
						operation: ['list'],
					},
				},
				default: '',
				placeholder: '/path/to/remote/folder',
				description: 'The path to the folder on the server',
			},
		],
	};

	methods = {
		credentialTest: {
			basicFtpApiTest,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {

		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('basicFtpApi') as unknown as IBasicFtpApiCredentials;

		const client = new Client();
    client.ftp.verbose = credentials.verboseLogging;

    // Function to replace spaces with new lines but preserve BEGIN and END markers correctly
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
			user: credentials.user,
			password: credentials.password,
			secure: credentials.secure,
			secureOptions,
		});

		const items = this.getInputData();
		let responseData;
		const returnData: IDataObject[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				switch (operation) {
					case 'download':
						const remotePath = this.getNodeParameter('remotePath', i) as string;
						const localPath = this.getNodeParameter('localPath', i) as string;
						await client.downloadTo(localPath, remotePath);
						break;
					case 'list':
						const remoteDir = this.getNodeParameter('remoteFolderPath', i) as string;
						await client.cd(remoteDir);
						const list = await client.list();
						responseData = list;
						break;
					default:
						throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported!`);
				}

				returnData.push(responseData as IDataObject);

				if(!responseData) {
					responseData = { success: true };
				}

				if (Array.isArray(responseData)) {
					returnData.push.apply(returnData, responseData as unknown as IDataObject[]);
				} else {
					returnData.push(responseData as IDataObject);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						error: error.message,
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error);
			} finally {
				client.close();
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
