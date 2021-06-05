import test from 'ava';

import SaplingError from '../../lib/SaplingError.js';

import parseMethodRouteKey from '../../core/parseMethodRouteKey.js';


test('parses uppercase GET correctly', t => {
	const { method, route } = parseMethodRouteKey('GET /data');

	t.is(method, 'get');
	t.is(route, '/data');
});

test('parses lowercase GET correctly', t => {
	const { method, route } = parseMethodRouteKey('get /data');

	t.is(method, 'get');
	t.is(route, '/data');
});

test('parses uppercase POST correctly', t => {
	const { method, route } = parseMethodRouteKey('POST /data');

	t.is(method, 'post');
	t.is(route, '/data');
});

test('parses lowercase POST correctly', t => {
	const { method, route } = parseMethodRouteKey('post /data');

	t.is(method, 'post');
	t.is(route, '/data');
});

test('parses uppercase DELETE correctly', t => {
	const { method, route } = parseMethodRouteKey('DELETE /data');

	t.is(method, 'delete');
	t.is(route, '/data');
});

test('parses lowercase DELETE correctly', t => {
	const { method, route } = parseMethodRouteKey('delete /data');

	t.is(method, 'delete');
	t.is(route, '/data');
});

test('parses no method correctly', t => {
	const { method, route } = parseMethodRouteKey('/data');

	t.is(method, 'get');
	t.is(route, '/data');
});


test('parses trailing slash correctly', t => {
	const { method, route } = parseMethodRouteKey('GET /data/');

	t.is(method, 'get');
	t.is(route, '/data');
});


test('throws an error with an incorrect method', t => {
	const error = t.throws(() => {
		parseMethodRouteKey('foo /data');
	}, {instanceOf: SaplingError});

	t.is(error.message, 'Problem parsing \'foo /data\': foo is not a valid method');
});


test('throws an error with too many segments', t => {
	const error = t.throws(() => {
		parseMethodRouteKey('get /data /api');
	}, {instanceOf: SaplingError});

	t.is(error.message, 'Problem parsing \'get /data /api\': too many segments');
});
