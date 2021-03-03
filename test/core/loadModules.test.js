const test = require('ava');
const _ = require('underscore');

const Notifications = require('../../lib/Notifications');
const Uploads = require('../../lib/Uploads');
const User = require('../../lib/User');

const loadModules = require('../../core/loadModules');


test.beforeEach(t => {
	t.context.app = require('../_utils/app')();
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
