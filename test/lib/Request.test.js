import test from 'ava';
import _ from 'underscore';

import Storage from '../../lib/Storage.js';
import User from '../../lib/User.js';

import Request from '../../lib/Request.js';


const originalConsole = console;


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();

	t.context.app.name = 'test';
	t.context.app.storage = new Storage(t.context.app, {
		posts: {
			title: {
				type: 'string',
				minlen: 20
			},
			likes: {
				type: 'number'
			},
			script: {
				type: 'string',
				trim: false
			},
			published: {
				type: 'boolean',
				access: 'owner',
				required: true
			},
			password: {
				type: 'string',
				access: 'admin'
			},
			tags: {
				type: 'string',
				default: 'uncategorised'
			}
		}
	});
	await t.context.app.storage.importDriver();

	t.context.app.request = new Request(t.context.app);
	t.context.app.user = new User(t.context.app);

	process.env.NODE_ENV = 'test';
	console = originalConsole;
});


/* getConstraints */

test.serial('returns correct constraints for request', t => {
	t.deepEqual(
		t.context.app.request.getConstraints({
			type: 'filter',
			fields: ['year', 'title'],
			values: ['2010', 'update*']
		}),
		{
			title: 'update*',
			year: '2010'
		}
	);
});

test.serial('returns empty object for request of wrong type', t => {
	t.deepEqual(
		t.context.app.request.getConstraints({
			type: 'all'
		}),
		{}
	);
});

test.serial('returns empty object for request with no constraints', t => {
	t.deepEqual(
		t.context.app.request.getConstraints({
			type: 'filter',
			fields: [],
			values: []
		}),
		{}
	);
});


/* getCreatorConstraint */

test.serial('returns correct constraints with session', t => {
	t.deepEqual(
		t.context.app.request.getCreatorConstraint({
			permission: {
				role: ['owner']
			},
			session: {
				user: {
					_id: '123'
				}
			}
		}, 'member'),
		{
			_creator: '123'
		}
	);
});

test.serial('returns correct constraints with no session', t => {
	t.deepEqual(
		t.context.app.request.getCreatorConstraint({
			permission: {
				role: ['owner']
			},
			session: {}
		}, 'member'),
		{}
	);
});

test.serial('returns no constraints when not protected', t => {
	t.deepEqual(
		t.context.app.request.getCreatorConstraint({
			permission: {
				role: ['member']
			},
			session: {}
		}, 'member'),
		{}
	);
});

test.serial('returns no constraints for admin', t => {
	t.deepEqual(
		t.context.app.request.getCreatorConstraint({
			permission: {
				role: ['owner']
			},
			session: {
				user: {
					role: 'admin'
				}
			}
		}, 'admin'),
		{}
	);
});


/* parse */

test.serial('parses a GET request correctly', t => {
	t.deepEqual(
		t.context.app.request.parse({
			method: 'get',
			url: '/data/posts',
			protocol: 'http',
			hostname: 'localhost'
		}),
		{
			collection: 'posts',
			fields: [],
			hostname: 'localhost',
			isLogged: false,
			method: 'get',
			protocol: 'http',
			query: {},
			type: 'all',
			url: '/data/posts',
			values: []
		}
	);
});

test.serial('parses a multi-segmented GET request correctly', t => {
	t.deepEqual(
		t.context.app.request.parse({
			method: 'get',
			url: '/data/posts/name/steve/year/1991/state/ny',
			protocol: 'http',
			hostname: 'localhost'
		}),
		{
			collection: 'posts',
			fields: ['name', 'year', 'state'],
			hostname: 'localhost',
			isLogged: false,
			method: 'get',
			protocol: 'http',
			query: {},
			type: 'filter',
			url: '/data/posts/name/steve/year/1991/state/ny',
			values: ['steve', '1991', 'ny']
		}
	);
});

test.serial('parses a POST create request correctly', t => {
	t.deepEqual(
		t.context.app.request.parse({
			method: 'post',
			url: '/data/posts',
			protocol: 'http',
			hostname: 'localhost',
			permission: {
				role: 'member'
			}
		}),
		{
			collection: 'posts',
			fields: [],
			hostname: 'localhost',
			isLogged: false,
			method: 'post',
			permission: {
				role: 'member'
			},
			protocol: 'http',
			query: {},
			type: 'all',
			url: '/data/posts',
			values: []
		}
	);
});

test.serial('parses a POST update request correctly', t => {
	t.deepEqual(
		t.context.app.request.parse({
			method: 'post',
			url: '/data/posts/_id/1',
			protocol: 'http',
			hostname: 'localhost',
			permission: {
				role: 'member'
			}
		}),
		{
			collection: 'posts',
			fields: ['_id'],
			hostname: 'localhost',
			isLogged: false,
			method: 'post',
			permission: {
				role: 'member'
			},
			protocol: 'http',
			query: {},
			type: 'filter',
			url: '/data/posts/_id/1',
			values: ['1']
		}
	);
});

test.serial('parses a DELETE request correctly', t => {
	t.deepEqual(
		t.context.app.request.parse({
			method: 'delete',
			url: '/data/posts/_id/1',
			protocol: 'http',
			hostname: 'localhost',
			permission: {
				role: 'member'
			}
		}),
		{
			collection: 'posts',
			fields: ['_id'],
			hostname: 'localhost',
			isLogged: false,
			method: 'delete',
			permission: {
				role: 'member'
			},
			protocol: 'http',
			query: {},
			type: 'filter',
			url: '/data/posts/_id/1',
			values: ['1']
		}
	);
});

test.serial('sets default value in a POST request correctly', t => {
	const request = t.context.app.request.parse({
		method: 'post',
		url: '/data/posts',
		protocol: 'http',
		hostname: 'localhost',
		permission: {
			role: 'member'
		},
		body: {
			title: 'Hello my ragtime, summertime gal',
			published: true
		}
	});

	t.deepEqual(request.body,
		{
			title: 'Hello my ragtime, summertime gal',
			published: true,
			tags: 'uncategorised'
		}
	);
});

test.serial('does not overwrite value with default in a POST request', t => {
	const request = t.context.app.request.parse({
		method: 'post',
		url: '/data/posts',
		protocol: 'http',
		hostname: 'localhost',
		permission: {
			role: 'member'
		},
		body: {
			title: 'Hello my ragtime, summertime gal',
			published: true,
			tags: 'news'
		}
	});

	t.deepEqual(request.body,
		{
			title: 'Hello my ragtime, summertime gal',
			published: true,
			tags: 'news'
		}
	);
});

test.serial('enforces field permissions in a POST request correctly', t => {
	t.plan(4);
	
	process.env.NODE_ENV = 'production';
	console.log = () => true;
	console.warn = (a, message) => {
		t.true([
			'NO ACCESS TO FIELD \'password\'',
			'Current permission level: null',
			'Required permission level: admin'
		].includes(message));
	};

	const request = t.context.app.request.parse({
		method: 'post',
		url: '/data/posts/_id/1',
		protocol: 'http',
		hostname: 'localhost',
		body: {
			title: 'Hello my ragtime, summertime gal',
			published: true,
			password: 'hunter12'
		},
		permission: {
			role: 'member'
		}
	});

	t.deepEqual(request.body,
		{
			title: 'Hello my ragtime, summertime gal',
			published: true
		}
	);
});

test.serial('converts string number into number in a POST request', t => {
	const request = t.context.app.request.parse({
		method: 'post',
		url: '/data/posts',
		protocol: 'http',
		hostname: 'localhost',
		permission: {
			role: 'member'
		},
		body: {
			title: 'Hello my ragtime, summertime gal',
			published: true,
			likes: '12'
		}
	});

	t.is(typeof request.body.likes, 'number');
	t.is(request.body.likes, 12);
});

test.serial('removes CSRF field from a POST request', t => {
	const request = t.context.app.request.parse({
		method: 'post',
		url: '/data/posts',
		protocol: 'http',
		hostname: 'localhost',
		permission: {
			role: 'member'
		},
		body: {
			title: 'Hello my ragtime, summertime gal',
			published: true,
			_csrf: 'abc123'
		}
	});

	t.false('_csrf' in request.body);
});

test.serial('sets logged-in status appropriately', t => {
	const request = t.context.app.request.parse({
		method: 'delete',
		url: '/data/posts/_id/1',
		protocol: 'http',
		hostname: 'localhost',
		session: {
			user: {
				_id: 1
			}
		}
	});

	t.true(request.isLogged);
});

test.serial('warns about unprotected writable request', t => {
	process.env.NODE_ENV = 'production';
	console.log = () => true;
	console.warn = (a, message) => {
		t.is(message, 'You should add a permission for `/data/posts/_id/1`.');
	};

	t.context.app.request.parse({
		method: 'post',
		url: '/data/posts/_id/1',
		protocol: 'http',
		hostname: 'localhost'
	});
});

test.serial('does not warn about protected writable request', t => {
	process.env.NODE_ENV = 'production';
	console.log = () => true;
	console.warn = (a, message) => {
		t.fail(message);
	};

	t.context.app.request.parse({
		method: 'post',
		url: '/data/posts/_id/1',
		protocol: 'http',
		hostname: 'localhost',
		permission: {
			role: 'member'
		}
	});

	t.pass();
});

test.serial('parses a request with a query string correctly', t => {
	t.deepEqual(
		t.context.app.request.parse({
			method: 'get',
			url: '/data/posts?sort=title,asc&limit=10',
			protocol: 'http',
			hostname: 'localhost'
		}),
		{
			collection: 'posts',
			fields: [],
			hostname: 'localhost',
			isLogged: false,
			method: 'get',
			protocol: 'http',
			query: {
				limit: '10',
				sort: 'title,asc'
			},
			type: 'all',
			url: '/data/posts?sort=title,asc&limit=10',
			values: []
		}
	);
});

test.serial('parses a request with a trailing slash correctly', t => {
	t.deepEqual(
		t.context.app.request.parse({
			method: 'get',
			url: '/data/posts/',
			protocol: 'http',
			hostname: 'localhost'
		}),
		{
			collection: 'posts',
			fields: [],
			hostname: 'localhost',
			isLogged: false,
			method: 'get',
			protocol: 'http',
			query: {},
			type: 'all',
			url: '/data/posts/',
			values: []
		}
	);
});


/* validateData */

test.serial('validates the body of a POST request correctly', t => {
	t.deepEqual(
		t.context.app.request.validateData(t.context.app.request.parse({
			method: 'post',
			url: '/data/posts/_id/1',
			protocol: 'http',
			hostname: 'localhost',
			body: {
				title: 'Hello',
				body: 'This is a post'
			}
		})),
		[
			{
				code: '1005',
				detail: '`title` must be at least 20 characters long.',
				meta: {
					key: 'title',
					rule: 'minlen',
					value: 20
				},
				status: '422',
				title: 'Input Too Short'
			}
		]
	);
});

test.serial('enforces a missing required field in a POST request', t => {
	t.deepEqual(
		t.context.app.request.validateData(t.context.app.request.parse({
			method: 'post',
			url: '/data/posts',
			protocol: 'http',
			hostname: 'localhost',
			body: {
				title: 'Hello my ragtime, summertime gal'
			}
		})),
		[
			{
				status: '422',
				code: '1001',
				title: 'Invalid Input',
				detail: 'You must provide a value for key `published`',
				meta: {
					key: 'published',
					rule: 'required'
				}
			}
		]
	);
});

test.serial('enforces mandatory models in strict mode in a POST request', t => {
	t.context.app.config.strict = true;

	t.deepEqual(
		t.context.app.request.validateData(t.context.app.request.parse({
			method: 'post',
			url: '/data/updates',
			protocol: 'http',
			hostname: 'localhost',
			body: {
				title: 'Hello my ragtime, summertime gal'
			}
		})),
		[
			{
				status: '500',
				code: '1010',
				title: 'Non-existent',
				detail: 'This model does not exist.',
				meta: {
					type: 'data',
					error: 'nonexistent'
				}
			}
		]
	);
});
