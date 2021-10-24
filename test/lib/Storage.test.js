import test from 'ava';

import Request from '../../lib/Request.js';
import Response from '../../lib/Response.js';
import SaplingError from '../../lib/SaplingError.js';
import Uploads from '../../lib/Uploads.js';
import User from '../../lib/User.js';

import getFileObject from '../_utils/getFileObject.js';

import Storage from '../../lib/Storage.js';


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();
	t.context.app.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.app.name = 'test';

	t.context.schema = {
		posts: {
			title: 'string',
			body: {
				type: 'string',
				required: true
			},
			tags: ['bad', 'data'],
			posted: {
				type: 'Date'
			},
			published: {
				type: 'boolean'
			}
		},
		tags: {
			name: 'string',
			post: 'reference'
		}
	};
});


/* importDriver */

test.serial('loads the default driver', async t => {
	await t.notThrowsAsync(async () => {
		t.context.app.storage = new Storage(t.context.app);
		return await t.context.app.storage.importDriver();
	});
});

test.serial('loads a driver case insensitively', async t => {
	t.context.app.config.db.driver = 'meMoRY';

	await t.notThrowsAsync(async () => {
		t.context.app.storage = new Storage(t.context.app);
		return await t.context.app.storage.importDriver();
	});
});

test.serial('loads a custom driver', async t => {
	t.context.app.config.db.driver = 'db-driver-custom';

	await t.throwsAsync(async () => {
		t.context.app.storage = new Storage(t.context.app);
		return await t.context.app.storage.importDriver();
	}, {
		instanceOf: SaplingError,
		message: 'Cannot find any DB driver for \'db-driver-custom\''
	});
});


/* createDatabase */

test.serial('imports driver if not yet imported', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	t.context.app.storage.importDriver = t.pass;

	await t.context.app.storage.createDatabase();
});

test.serial('does not import driver if already imported', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();
	t.context.app.storage.importDriver = t.fail;

	await t.context.app.storage.createDatabase();
	t.pass();
});




/* getRules */

test.serial('returns and normalises the given ruleset', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	t.deepEqual(
		t.context.app.storage.getRules('posts'),
		{
			title: {
				type: 'string'
			},
			body: {
				type: 'string',
				required: true
			},
			tags: {
				type: 'string'
			},
			posted: {
				type: 'date'
			},
			published: {
				type: 'boolean'
			}
		}
	);
});

test.serial('returns an empty object for nonexistent ruleset', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	t.deepEqual(
		t.context.app.storage.getRules('updates'),
		{}
	);
});


/* getRule */

test.serial('returns and normalises the given rule', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	t.deepEqual(
		t.context.app.storage.getRule('body', 'posts'),
		{
			type: 'string',
			required: true
		}
	);
});

test.serial('returns a default object for nonexistent rule', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	t.deepEqual(
		t.context.app.storage.getRule('location', 'posts'),
		{
			type: 'string'
		}
	);
});

test.serial('returns null for nonexistent rule in strict mode', async t => {
	t.context.app.config.strict = true;
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	t.is(
		t.context.app.storage.getRule('location', 'posts'),
		null
	);
});


/* get */

test.serial('gets multiple records', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	const response = await t.context.app.storage.get({
		url: '/data/posts',
		permission: { role: 'member' },
		session: { role: 'member' }
	});

	t.is(response.length, 2);
	t.is(response[0].title, 'Hello');
	t.true('_id' in response[0]);
	t.is(response[1].title, 'Hi');
	t.true('_id' in response[1]);
});

test.serial('gets a single record', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	const response = await t.context.app.storage.get({
		url: '/data/posts/title/Hi',
		permission: { role: [ 'member' ] },
		session: { user: { role: 'member' } }
	});

	t.is(response.length, 1);
	t.is(response[0].title, 'Hi');
	t.true('_id' in response[0]);
});


/* post */

test.serial('posts a record', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	const response = await t.context.app.storage.post({
		url: '/data/posts',
		body: {
			title: 'Hello',
			body: 'This is a post'
		}
	});

	t.is(response.length, 1);
	t.is(response[0].title, 'Hello');
	t.is(response[0].body, 'This is a post');
	t.true('_id' in response[0]);
	t.true('_created' in response[0]);
});

test.serial('attaches creator details', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	const response = await t.context.app.storage.post({
		url: '/data/posts',
		body: {
			title: 'Howdy',
			body: 'This is a post'
		},
		permission: { role: [ 'member' ] },
		session: {
			user: {
				role: 'admin',
				_id: '123',
				email: 'foo@example.com'
			}
		}
	});

	t.is(response.length, 1);
	t.is(response[0].title, 'Howdy');
	t.is(response[0]._creator, '123');
	t.is(response[0]._creatorEmail, 'foo@example.com');
	t.true('_id' in response[0]);
});

test.serial('modifies a record', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	const response = await t.context.app.storage.post({
		url: '/data/posts/title/Hi',
		body: {
			title: 'Howdy'
		}
	});

	t.is(response.length, 1);
	t.is(response[0].title, 'Howdy');
	t.true('_id' in response[0]);
});

test.serial('attaches updator details', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	await t.context.app.storage.post({
		url: '/data/posts',
		body: {
			title: 'Howdy',
			body: 'This is a post'
		},
		permission: { role: [ 'member' ] },
		session: {
			user: {
				role: 'admin',
				_id: '123',
				email: 'foo@example.com'
			}
		}
	});

	const response = await t.context.app.storage.post({
		url: '/data/posts/title/Howdy',
		body: {
			title: 'Hello'
		},
		permission: { role: [ 'member' ] },
		session: {
			user: {
				role: 'admin',
				_id: '345',
				email: 'bar@example.com'
			}
		}
	});

	t.is(response.length, 1);
	t.is(response[0].title, 'Hello');
	t.is(response[0]._creator, '123');
	t.is(response[0]._creatorEmail, 'foo@example.com');
	t.is(response[0]._lastUpdator, '345');
	t.is(response[0]._lastUpdatorEmail, 'bar@example.com');
	t.true('_id' in response[0]);
});

test.serial('formats specific fields correctly', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	const response = await t.context.app.storage.post({
		url: '/data/posts',
		body: {
			title: 'Hello',
			body: 'This is a post',
			posted: '1996-02-10T02:00:00+02:00',
			published: 'true'
		}
	});

	t.is(response.length, 1);
	t.is(response[0].posted, 823910400000);
	t.is(typeof response[0].posted, 'number');
	t.is(response[0].published, true);
	t.is(typeof response[0].published, 'boolean');
});

test.serial('handles request with files if file uploads are configured', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	t.context.app.config.upload = {
		type: 'local',
		destination: 'uploads'
	};
	t.context.app.uploads = new Uploads(t.context.app);

	const response = await t.context.app.storage.post({
		url: '/data/posts',
		body: {
			title: 'Howdy',
			body: 'This is a post'
		},
		files: {
			image: getFileObject('image.png')
		}
	});

	t.false(response.error instanceof SaplingError);
});

test.serial('responds with an error to request with files if file uploads are not configured', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);

	const response = await t.context.app.storage.post({
		url: '/data/posts',
		body: {
			title: 'Howdy',
			body: 'This is a post'
		},
		files: {
			image: getFileObject('image.png')
		}
	});

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);
	t.is(response.error.message, 'File uploads are not allowed');
});

test.serial('responds with an error if write fails', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	t.context.app.storage.db.write = () => {
		throw 'DB error';
	};

	const response = await t.context.app.storage.post({
		url: '/data/posts',
		body: {
			title: 'Howdy'
		}
	});

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);
});

test.serial('responds with an error if modify fails', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	t.context.app.storage.db.modify = () => {
		throw 'DB error';
	};

	const response = await t.context.app.storage.post({
		url: '/data/posts/title/Hi',
		body: {
			title: 'Howdy'
		}
	});

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);
});


/* delete */

test.serial('deletes a record', async t => {
	t.context.app.storage = new Storage(t.context.app, t.context.schema);
	await t.context.app.storage.importDriver();

	await t.context.app.storage.db.write('posts', { title: 'Hello' });
	await t.context.app.storage.db.write('posts', { title: 'Hi' });

	const response = await t.context.app.storage.delete({
		url: '/data/posts/title/Hi'
	});

	t.deepEqual(response, [ { success: true } ]);
});
