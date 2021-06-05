import test from 'ava';
import _ from 'underscore';
import express from 'express';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';

import Storage from '../../lib/Storage.js';
import User from '../../lib/User.js';

import loadRest from '../../core/loadRest.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = _.extend({
		name: 'test'
	}, (await import('../_utils/app.js')).default());

	t.context.app.server = express();

	t.context.app.storage = new Storage(t.context.app, {
		name: 'test',
		schema: {},
		config: { db: { driver: 'Memory' } },
		dir: __dirname
	});

	t.context.app.user = new User(t.context.app);

	t.context.app.runHook = import('../../core/runHook');

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.response = (await import('../_utils/response.js')).default();
});


test.serial.cb('loads get endpoints', t => {
	t.plan(2);

	t.notThrows(() => {
		loadRest.call(t.context.app);
	});

	request(t.context.app.server)
		.get('/data/posts')
		.expect(200, (error, response) => {
			t.is(response.status, 200);
			t.end();
		});
});

/* Hangs on line 693 of Storage.js for some reason */
test.serial.cb.skip('loads post endpoints', t => {
	t.plan(2);

	t.notThrows(() => {
		loadRest.call(t.context.app);
	});

	request(t.context.app.server)
		.post('/data/posts')
		.send({ title: 'Hello' })
		.set('Accept', 'application/json')
		.expect(200, (error, response) => {
			t.is(response.status, 200);
			t.end();
		});
});

test.serial.cb('loads delete endpoints', t => {
	t.plan(2);

	t.notThrows(() => {
		loadRest.call(t.context.app);
	});

	request(t.context.app.server)
		.delete('/data/posts')
		.end((error, response) => {
			t.is(response.status, 200);
			t.end();
		});
});

test('calls callback when specified', async t => {
	await loadRest.call(t.context.app, () => {
		t.pass();
	});
});
