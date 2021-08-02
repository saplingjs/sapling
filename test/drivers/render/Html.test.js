import test from 'ava';
import path from 'path';
import { fileURLToPath } from 'url';

import SaplingError from '../../../lib/SaplingError.js';

import Html from '../../../drivers/render/Html.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.before(t => {
	t.context.html = new Html({}, path.join(__dirname, '../../_data/views'));
});


test('renders a plain view', async t => {
	const html = await t.context.html.render('plain.html');

	t.is(html, '<strong>This is a template.</strong>');
});

test('renders a view with data tag without spaces', async t => {
	const html = await t.context.html.render('tight.html', { template: 'view' });

	t.is(html, '<strong>This is a view.</strong>');
});

test('renders a view with data tag with spaces', async t => {
	const html = await t.context.html.render('loose.html', { template: 'view' });

	t.is(html, '<strong>This is a view.</strong>');
});

test('renders a view with data tag with safe filter', async t => {
	const html = await t.context.html.render('safe.html', { template: 'view' });

	t.is(html, '<strong>This is a view.</strong>');
});

test('returns an error for non-existant view', async t => {
	const html = await t.context.html.render('nonexistant.html', { template: 'view' });

	t.true(html instanceof SaplingError);
});

test('register tags is stubbed', async t => {
	t.true(t.context.html.registerTags());
});
