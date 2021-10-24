import test from 'ava';
import _ from 'underscore';

import Notifications from '../../lib/Notifications.js';
import Uploads from '../../lib/Uploads.js';
import User from '../../lib/User.js';

import loadModules from '../../core/loadModules.js';


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();
});


test('loads users', t => {
	loadModules.call(t.context.app);

	t.true(t.context.app.user instanceof User);
});

test('loads notifications when specified', t => {
	t.context.app.config.mail = {
		type: 'SMTP',
		service: 'Gmail',
		auth: {
			user: '',
			password: ''
		}
	};

	loadModules.call(t.context.app);

	t.true(t.context.app.notifications instanceof Notifications);
});

test('does not load notifications when not specified', t => {
	loadModules.call(t.context.app);

	t.false('notifications' in t.context.app);
});

test('loads uploads when specified', t => {
	t.context.app.config.upload = {
		type: 'local',
		destination: 'public/uploads'
	};

	loadModules.call(t.context.app);

	t.true(t.context.app.uploads instanceof Uploads);
});

test('does not load uploads when not specified', t => {
	loadModules.call(t.context.app);

	t.false('uploads' in t.context.app);
});

test('calls callback when specified', t => {
	loadModules.call(t.context.app, () => {
		t.pass();
	});
});
