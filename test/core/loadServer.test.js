import test from 'ava';
import request from 'supertest';

import loadServer from '../../core/loadServer.js';


const cookies = response => {
	return response.headers['set-cookie'].map(function (cookies) {
		return cookies.split(';')[0]
	}).join(';')
};


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();

	t.context.app.config = {
		sessionStore: {
			type: null,
			options: {}
		},
		render: {
			driver: 'html'
		},
		db: {
			driver: 'Memory'
		}
	};
});


test.serial('loads server', t => {
	t.notThrows(() => {
		loadServer.call(t.context.app, {});
	});
});

test.serial('calls callback when specified', t => {
	t.notThrows(() => {
		loadServer.call(t.context.app, {}, () => {
			t.pass();
		});
	});
});

test.serial('responds to data options preflight', async t => {
	t.notThrows(() => {
		loadServer.call(t.context.app, {});
	});

	const response = await request(t.context.app.server).options('/data/posts');

	t.is(response.status, 200);
});

test.serial('loads server with cors', async t => {
	t.context.app.config.cors = true;

	t.notThrows(() => {
		return loadServer.call(t.context.app, {});
	});

	t.context.app.server.get('/api/hook', (request, response) => {
		response.sendStatus(200);
	});
	t.context.app.server.get('/data/posts', (request, response) => {
		response.sendStatus(200);
	});

	const apiResponse = await request(t.context.app.server).get('/api/hook');

	t.true('access-control-allow-origin' in apiResponse.headers);
	t.true('access-control-allow-methods' in apiResponse.headers);
	t.true('access-control-allow-headers' in apiResponse.headers);

	t.is(apiResponse.headers['access-control-allow-origin'], '*');
	t.is(apiResponse.headers['access-control-allow-methods'], 'GET,POST');
	t.is(apiResponse.headers['access-control-allow-headers'], 'Content-Type');

	const dataResponse = await request(t.context.app.server).get('/data/posts');

	t.true('access-control-allow-origin' in dataResponse.headers);
	t.true('access-control-allow-methods' in dataResponse.headers);
	t.true('access-control-allow-headers' in dataResponse.headers);

	t.is(dataResponse.headers['access-control-allow-origin'], '*');
	t.is(dataResponse.headers['access-control-allow-methods'], 'GET,PUT,POST,DELETE');
	t.is(dataResponse.headers['access-control-allow-headers'], 'Content-Type');
});

test.serial('loads server with csrf to respond with an error with no token', async t => {
	t.context.app.config.csrf = true;

	t.notThrows(() => {
		return loadServer.call(t.context.app, {});
	});

	t.context.app.server.post('/data/posts', (request, response) => {
		response.sendStatus(200);
	});

	const response = await request(t.context.app.server).post('/data/posts');
	t.is(response.status, 500);
	t.is(response.body.errors.length, 1);
	t.is(response.body.errors[0].title, 'Invalid CSRF token');
});

test.serial.cb('loads server with csrf to respond with an error with invalid token', t => {
	t.context.app.config.csrf = true;

	t.notThrows(() => {
		return loadServer.call(t.context.app, {});
	});

	t.context.app.server.post('/data/posts', (request, response) => {
		response.sendStatus(200);
	});

	request(t.context.app.server)
		.get('/token')
		.expect(200, (error, response) => {
			request(t.context.app.server)
				.post('/data/posts')
				.set('Cookie', cookies(response))
				.send('_csrf=' + encodeURIComponent('invalid'))
				.expect(500, (error, response) => {
					t.is(response.status, 500);
					t.is(response.body.errors.length, 1);
					t.is(response.body.errors[0].title, 'Invalid CSRF token');
					t.end();
				});
		});
});

test.serial.cb('loads server with csrf to respond normally with valid token', t => {
	t.context.app.config.csrf = true;

	t.notThrows(() => {
		return loadServer.call(t.context.app, {});
	});

	t.context.app.server.get('/token', (request, response) => {
		response.json({ token: request.csrfToken() });
	});

	t.context.app.server.post('/data/posts', (request, response) => {
		response.sendStatus(200);
	});

	request(t.context.app.server)
		.get('/token')
		.expect(200, (error, response) => {
			request(t.context.app.server)
				.post('/data/posts')
				.set('Cookie', cookies(response))
				.send('_csrf=' + encodeURIComponent(response.body.token))
				.expect(200, (error, response) => {
					t.is(response.status, 200);
					t.end();
				});
		});
});

test.serial('loads server with a string-based publicDir', async t => {
	t.context.app.config.publicDir = 'public';

	t.notThrows(() => {
		loadServer.call(t.context.app, {});
	});

	const response = await request(t.context.app.server).get('/public/app.css');
	t.is(response.status, 200);
	t.true(response.headers['content-type'].includes('text/css'));
});

test.serial('loads server with an array-based publicDir', async t => {
	t.context.app.config.publicDir = [ 'public', 'static' ];

	t.notThrows(() => {
		loadServer.call(t.context.app, {});
	});

	const publicResponse = await request(t.context.app.server).get('/public/app.css');
	t.is(publicResponse.status, 200);
	t.true(publicResponse.headers['content-type'].includes('text/css'));

	const staticResponse = await request(t.context.app.server).get('/static/response/404.html');
	t.is(staticResponse.status, 200);
	t.true(staticResponse.headers['content-type'].includes('text/html'));
});

test.serial.cb('loads server with compression', t => {
	t.plan(2);

	t.context.app.config.compression = true;

	t.notThrows(() => {
		loadServer.call(t.context.app, {});
	});

	t.context.app.server.get('/app', (request, response) => {
		response.setHeader('Content-Type', 'text/html');
		response.end('<strong>Hello</strong>');
	});

	request(t.context.app.server)
		.get('/app')
		.set('Accept-Encoding', 'gzip')
		.expect('Content-Encoding', 'gzip', (error, response) => {
			if (error) {
				t.fail(error);
			} else {
				t.pass();
			}
			
			t.end();
		});
});
