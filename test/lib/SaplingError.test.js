import test from 'ava';

import SaplingError from '../../lib/SaplingError.js';


test('creates an error with a string', t => {
	const error = new SaplingError('Error message');

	t.is(typeof error.json, 'object');
	t.is(error.json.errors.length, 1);
	t.is(error.json.errors[0].title, 'Error message');
});

test('creates an error with an array', t => {
	const error = new SaplingError(['Error 1', 'Error 2']);

	t.is(typeof error.json, 'object');
	t.is(error.json.errors.length, 2);
	t.is(error.json.errors[0].title, 'Error 1');
	t.is(error.json.errors[1].title, 'Error 2');
});

test('creates an error with an object', t => {
	const error = new SaplingError({ title: 'Error message' });

	t.is(typeof error.json, 'object');
	t.is(error.json.errors.length, 1);
	t.deepEqual(error.json.errors[0], { title: 'Error message' });
});
