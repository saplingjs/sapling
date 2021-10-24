import test from 'ava';
import MailDev from 'maildev';

import SaplingError from '../../lib/SaplingError.js';

import Notifications from '../../lib/Notifications.js';


const setup = (t, host, port) => {
	t.context.app.config.mail = {
		host: host,
		port: port,
		secure: false,
		auth: {
			user: 'john',
			pass: 'abc123'
		},
		tls: {
			rejectUnauthorized: false
		}
	};

	t.context.notifications = new Notifications(t.context.app);
}


test.before(t => {
	t.context.maildev = new MailDev({
		silent: true
	});
	t.context.maildev.listen();

	t.context.templateData = {
		name: 'untitled',
		key: 'abc123',
		url: '/'
	};
});

test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();
});


test.cb('sends a notification', t => {
	process.env.NODE_ENV = 'production';
	t.timeout(1000);
	t.plan(3);

	setup(t, '0.0.0.0', 1025);

	t.context.maildev.on('new', email => {
		t.is(email.to[0].address, 'john@example.com');
		t.is(email.subject, 'Forgotten Password');
		t.end();
	});

	t.notThrowsAsync(async () => {
		await t.context.notifications.sendNotification('lostpass', t.context.templateData, 'john@example.com');
	});
});

test('throws an error if it cannot connect', async t => {
	setup(t, '0.0.0.0', 1023);

	await t.throwsAsync(async () => {
		return await t.context.notifications.sendNotification('lostpass', t.context.templateData, 'john@example.com');
	});
});

test('throws an error if notification template does not exist', async t => {
	setup(t, '0.0.0.0', 1025);

	await t.throwsAsync(async () => {
		return await t.context.notifications.sendNotification('nonexistant', t.context.templateData, 'john@example.com');
	}, {
		instanceOf: SaplingError,
		message: 'Could not load notification template `nonexistant`.'
	});
});

test('throws an error if recipient email address is mangled', async t => {
	setup(t, '0.0.0.0', 1025);

	await t.throwsAsync(async () => {
		return await t.context.notifications.sendNotification('lostpass', t.context.templateData, 'john@exam');
	}, {
		instanceOf: SaplingError,
		message: 'Cannot send notification: john@exam is not a valid email address'
	});
});

test('throws an error if config is not set', async t => {
	setup(t, null, 1025);

	await t.throwsAsync(async () => {
		return await t.context.notifications.sendNotification('lostpass', t.context.templateData, 'john@example.com');
	}, {
		instanceOf: SaplingError,
		message: 'Cannot send notification: mail host or authentication not set'
	});
});


test.after.always(t => {
	t.context.maildev.close();
});
