import test from 'ava';
import path from 'path';
import { fileURLToPath } from 'url';

import SaplingError from '../../lib/SaplingError.js';

import Templating from '../../lib/Templating.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();
	t.context.request = (await import('../_utils/request.js')).default();
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
