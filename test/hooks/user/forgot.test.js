import test from 'ava';
import _ from 'underscore';
import path from 'path';
import { fileURLToPath } from 'url';

import Request from '../../../lib/Request.js';
import Response from '../../../lib/Response.js';
import SaplingError from '../../../lib/SaplingError.js';
import Storage from '../../../lib/Storage.js';
import User from '../../../lib/User.js';

import forgot from '../../../hooks/sapling/user/forgot.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = _.extend({
		name: 'untitled'
	}, (await import('../../_utils/app.js')).default());

	t.context.app.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);

	t.context.app.storage = new Storage(t.context.app, {
		name: 'test',
		schema: {},
		config: { db: { driver: 'Memory' } },
		dir: __dirname
	});
	await t.context.app.storage.importDriver();

	t.context.request = (await import('../../_utils/request.js')).default();
	t.context.response = (await import('../../_utils/response.js')).default();
});


test.serial('responds when known email address is used', async t => {
	t.plan(7);

	const user = await t.context.app.storage.db.write('users', { email: 'john@example.com', role: 'member', password: 'hunter12', _salt: 'abc123' });

	t.context.request.body.email = 'john@example.com';

	t.context.app.notifications = {
		sendNotification: async (template, templateData, email) => {
			t.is(template, 'lostpass');
			t.is(templateData.key.length, 22);
			t.is(email, user[0].email);

			const keyedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
			t.true('_authkey' in keyedUser[0]);
			t.is(keyedUser[0]._authkey, templateData.key);
		}
	};

	const response = await forgot(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.content.success);
});

test.serial('redirects when known email address is used', async t => {
	t.plan(6);

	const user = await t.context.app.storage.db.write('users', { email: 'john@example.com', role: 'member', password: 'hunter12', _salt: 'abc123' });

	t.context.request.body.email = 'john@example.com';
	t.context.request.query.redirect = '/thank-you';

	t.context.app.notifications = {
		sendNotification: async (template, templateData, email) => {
			t.is(template, 'lostpass');
			t.is(templateData.key.length, 22);
			t.is(email, user[0].email);

			const keyedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
			t.true('_authkey' in keyedUser[0]);
			t.is(keyedUser[0]._authkey, templateData.key);
		}
	};

	t.context.response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	await forgot(t.context.app, t.context.request, t.context.response);
});

test.serial('responds but no-ops when unknown email address is used', async t => {
	t.context.request.body.email = 'john@example.com';

	t.context.app.notifications = {
		sendNotification: () => {
			t.fail('Notification should not be sent');
		}
	};

	const response = await forgot(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.content.success);
});

test.serial('redirects but no-ops when unknown email address is used', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.query.redirect = '/thank-you';

	t.context.app.notifications = {
		sendNotification: () => {
			t.fail('Notification should not be sent');
		}
	};

	t.context.response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	await forgot(t.context.app, t.context.request, t.context.response);
});

test.serial('responds with an error when a mangled email address is used', async t => {
	t.context.request.body.email = 'john@exam';

	const response = await forgot(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);
});

test.serial('handles notification sending failing', async t => {
	t.plan(1);

	const user = await t.context.app.storage.db.write('users', { email: 'john@example.com', role: 'member', password: 'hunter12', _salt: 'abc123' });

	process.env.NODE_ENV = 'production';
	console.log = () => true;

	t.context.request.body.email = 'john@example.com';

	t.context.app.notifications = {
		sendNotification: () => {
			throw Error('Something went wrong');
		}
	};

	console.error = (workerId, message) => {
		t.true(message instanceof SaplingError);
	};

	await forgot(t.context.app, t.context.request, t.context.response);
});


test.after.always(t => {
	process.env.NODE_ENV = 'test';
});
