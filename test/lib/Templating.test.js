const test = require('ava');
const path = require('path');

const SaplingError = require('../../lib/SaplingError');

const Templating = require('../../lib/Templating');


test.beforeEach(t => {
	t.context.app = require('../_utils/app')();
	t.context.request = require('../_utils/request')();
});


test.serial('loads the default renderer', t => {
	t.notThrows(() => {
		t.context.app.templating = new Templating(t.context.app);
	});
});

test.serial('loads a renderer case insensitively', t => {
	t.context.app.config.render.driver = 'hTMl';

	t.notThrows(() => {
		t.context.app.templating = new Templating(t.context.app);
	});
});

test.serial('loads a custom renderer', t => {
	t.context.app.config.render.driver = 'render-driver-custom';

	t.throws(() => {
		t.context.app.templating = new Templating(t.context.app);
	}, {
		instanceOf: SaplingError,
		message: 'Cannot find any render driver for \'render-driver-custom\''
	});
});

test.serial('renders a view', async t => {
	t.context.app.templating = new Templating(t.context.app, path.join(__dirname, '../_data/views'));

	const result = await t.context.app.templating.renderView('plain', {}, t.context.request);

	t.is(result, '<strong>This is a template.</strong>');
});

test.serial('renders a view with CSRF token', async t => {
	t.context.app.config.csrf = true;
	t.context.app.templating = new Templating(t.context.app, path.join(__dirname, '../_data/views'));

	const result = await t.context.app.templating.renderView('csrf', {}, t.context.request);

	t.is(result, '<h1>CSRF is abc</h1>');
});
