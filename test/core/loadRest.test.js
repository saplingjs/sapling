import test from 'ava';
import _ from 'underscore';

import { App as TinyHTTP } from '@tinyhttp/app';
import session from 'express-session';
import bodyParser from 'body-parser';
import request from 'supertest';

import Request from '../../lib/Request.js';
import Storage from '../../lib/Storage.js';
import User from '../../lib/User.js';
import runHook from '../../core/runHook.js';

import loadRest from '../../core/loadRest.js';


test.beforeEach(async t => {
	t.context.app = _.extend({
		name: 'test'
	}, (await import('../_utils/app.js')).default());

	t.context.app.server = new TinyHTTP();
	t.context.app.live = t.context.app.server.listen();
	t.context.app.server.use(session({ secret: 'abc', resave: false, saveUninitialized: true, cookie: { maxAge: null } }));
	t.context.app.server.use(bodyParser.urlencoded({ extended: true }));
	t.context.app.server.use(bodyParser.json());

	t.context.app.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);

	t.context.app.name = 'test';
	t.context.app.storage = new Storage(t.context.app, { posts: { title: { type: 'string' } } });
	await t.context.app.storage.importDriver();

	t.context.app.runHook = runHook;

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.response = (await import('../_utils/response.js')).default();
});


test.serial('loads get endpoints', async t => {
	t.plan(2);

	return new Promise((resolve) => {
		t.notThrows(() => {
			loadRest.call(t.context.app);
		});

		request(t.context.app.live)
			.get('/data/posts')
			.expect(200, (error, response) => {
				t.is(response.status, 200);
				resolve();
			});
	});
});

test.serial('loads post endpoints', async t => {
	t.plan(2);

	return new Promise((resolve) => {
		t.notThrows(() => {
			loadRest.call(t.context.app);
		});

		request(t.context.app.live)
			.post('/data/posts')
			.send('title=Hello')
			.set('Accept', 'application/json')
			.expect(200, (error, response) => {
				t.is(response.status, 200);
				resolve();
			});
	});
});

test.serial('loads delete endpoints', async t => {
	t.plan(2);

	return new Promise((resolve) => {
		t.notThrows(() => {
			loadRest.call(t.context.app);
		});

		request(t.context.app.live)
			.delete('/data/posts')
			.end((error, response) => {
				t.is(response.status, 200);
				resolve();
			});
	});
});

test.serial('calls callback when specified', async t => {
	await loadRest.call(t.context.app, () => {
		t.pass();
	});
});
