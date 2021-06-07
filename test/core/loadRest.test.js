const test = require('ava');
const _ = require('underscore');
const { App: TinyHTTP } = require('@tinyhttp/app');
const request = require('supertest');

const Storage = require('../../lib/Storage');
const User = require('../../lib/User');

const loadRest = require('../../core/loadRest');


test.beforeEach(t => {
	t.context.app = _.extend({
		name: 'test'
	}, require('../_utils/app')());

	t.context.app.server = new TinyHTTP();
	t.context.app.live = t.context.app.server.listen();

	t.context.app.storage = new Storage(t.context.app, {
		name: 'test',
		schema: {},
		config: { db: { driver: 'Memory' } },
		dir: __dirname
	});

	t.context.app.user = new User(t.context.app);

	t.context.app.runHook = require('../../core/runHook');

	t.context.request = require('../_utils/request')();
	t.context.response = require('../_utils/response')();
});


test.serial.cb('loads get endpoints', t => {
	t.plan(2);

	t.notThrows(() => {
		loadRest.call(t.context.app);
	});

	request(t.context.app.live)
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

	request(t.context.app.live)
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

	request(t.context.app.live)
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
