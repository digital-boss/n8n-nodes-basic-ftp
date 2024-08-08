import {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
} from 'n8n-workflow';
import ftp from 'basic-ftp';
import { IBasicFtpApiCredentials } from '../../credentials/BasicFtpApi.credentials';

const fail = (message?: string | object): INodeCredentialTestResult => {
	const msg = typeof message === 'string'
		? message
		: typeof message === 'undefined'
		? 'Auth failed'
		: `Auth failed: ${JSON.stringify(message)}`;

	return {
		status: 'Error',
		message: msg,
	};
};

const success = (message?: string): INodeCredentialTestResult => {
	const msg = typeof message === 'undefined'
		? 'Authentication successful!'
		: message;

	return {
		status: 'OK',
		message: msg,
	};
};

export async function basicFtpApiTest(this: ICredentialTestFunctions, credentials: ICredentialsDecrypted): Promise<INodeCredentialTestResult> {
	const creds = credentials.data as unknown as IBasicFtpApiCredentials;

	const client = new ftp.Client();
	try {
		// Connect to the FTP server
		await client.access({
			host: creds.host,
			user: creds.user,
			password: creds.password,
			secure: creds.secure,
			secureOptions: {
				cert: creds.certificate,
				key: creds.privateKey,
				rejectUnauthorized: creds.ignoreTlsIssues,
			},
		});
		return success();
	} catch (error) {
		return fail(error);
	} finally {
		client.close();
	}
}
