import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export interface IBasicFtpApiCredentials {
	host: string;
	user: string;
	password: string;
	privateKey: string;
	certificate: string;
	secure: boolean;
	ignoreTlsIssues: boolean;
	verboseLogging: boolean;
}

export class BasicFtpApi implements ICredentialType {
	name = 'basicFtpApi';
	displayName = 'BasicFtp API';
	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			required: true,
			type: 'string',
			default: '',
		},
		{
			displayName: 'User',
			name: 'user',
			required: true,
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			required: true,
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
			description: 'Private key to use for FTP',
		},
		{
			displayName: 'Certificate',
			name: 'certificate',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
			description: 'Certificate to use for FTP',
		},
		{
			displayName: 'Secure',
			name: 'secure',
			type: 'boolean',
			default: true,
			description: 'Enable FTPS',
		},
		{
			displayName: 'Ignore TLS Issues',
			name: 'ignoreTlsIssues',
			type: 'boolean',
			default: false,
			description: 'Ignore any TLS issues like expired certificates, self-signed certificates',
		},
		{
			displayName: 'Verbose Logging',
			name: 'verboseLogging',
			type: 'boolean',
			default: false,
			description: 'Enable verbose logging',
		},
	];
}
