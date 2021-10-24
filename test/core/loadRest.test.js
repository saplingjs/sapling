import test from 'ava';
import _ from 'underscore';
import express from 'express';
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

	t.context.app.server = express();
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

test.serial.cb('loads post endpoints', t => {
	t.plan(2);

	t.notThrows(() => {
		loadRest.call(t.context.app);
	});

	request(t.context.app.server)
		.post('/data/posts')
		.send('title=Hello')
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

test.serial('calls callback when specified', async t => {
	await loadRest.call(t.context.app, () => {
		t.pass();
	});
});
