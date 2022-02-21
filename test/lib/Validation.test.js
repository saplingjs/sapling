import test from 'ava';

import Validation from '../../lib/Validation.js';

test.beforeEach(t => {
	t.context.validator = new Validation();
});


/* validateFieldName */

test('validates correct field names non-strictly', t => {
	t.true(t.context.validator.validateFieldName('firstname', false));
	t.true(t.context.validator.validateFieldName('first_name', false));
	t.true(t.context.validator.validateFieldName('FirstName', false));
	t.true(t.context.validator.validateFieldName('First_Name', false));
	t.true(t.context.validator.validateFieldName('_secret', false));
	t.true(t.context.validator.validateFieldName('id_', false));
	t.true(t.context.validator.validateFieldName('first_name2', false));
	t.true(t.context.validator.validateFieldName('123', false));
});

test('validates correct field names strictly', t => {
	t.true(t.context.validator.validateFieldName('firstname', true));
	t.true(t.context.validator.validateFieldName('FirstName', true));
	t.true(t.context.validator.validateFieldName('firstname2', false));
	t.true(t.context.validator.validateFieldName('123', false));
});

test('invalidates incorrect field names non-strictly', t => {
	t.false(t.context.validator.validateFieldName('first-name', false));
	t.false(t.context.validator.validateFieldName('first name', false));
	t.false(t.context.validator.validateFieldName('FirstNäme', false));
	t.false(t.context.validator.validateFieldName('', false));
});

test('invalidates incorrect field names strictly', t => {
	t.false(t.context.validator.validateFieldName('first_name', true));
	t.false(t.context.validator.validateFieldName('first-name', true));
	t.false(t.context.validator.validateFieldName('first name', false));
	t.false(t.context.validator.validateFieldName('FirstNäme', true));
	t.false(t.context.validator.validateFieldName('', true));
});


/* validate */

test('runs all validation methods', t => {
	t.context.validator.validate('John', 'first_name', { type: 'string' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validate('male', 'gender', { values: ['male', 'female', 'other'] });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validate('hunter12', 'password', { minlen: 3, maxlen: 64 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validate(32, 'age', { min: 16, max: 99 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validate('john@example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);
});


/* validateType */

test('validates correct type', t => {
	t.context.validator.validateType('John', 'first_name', 'string');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType('John', 'first_name', { type: 'string' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateType(23, 'age', 'number');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType('23', 'age', 'number');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType(23, 'age', { type: 'number' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateType('abc123', 'address_id', 'reference');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType('abc123', 'address_id', { type: 'reference' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateType(true, 'is_member', 'boolean');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType(1, 'is_member', 'boolean');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType('true', 'is_member', 'boolean');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType('1', 'is_member', 'boolean');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType(true, 'is_member', { type: 'boolean' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateType('17-12-1996', 'dob', 'date');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType(new Date('December 17, 1995 03:24:00'), 'dob', 'date');
	t.is(t.context.validator.errors.length, 0);
	t.context.validator.validateType('17-12-1996', 'dob', { type: 'date' });
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates incorrect type', t => {
	t.context.validator.validateType(123, 'first_name', 'string');
	t.is(t.context.validator.errors.length, 1);
	t.context.validator.validateType(true, 'first_name', { type: 'string' });
	t.is(t.context.validator.errors.length, 2);

	t.context.validator.validateType('Kate', 'age', 'number');
	t.is(t.context.validator.errors.length, 3);
	t.context.validator.validateType(true, 'age', { type: 'number' });
	t.is(t.context.validator.errors.length, 4);

	t.context.validator.validateType(false, 'address_id', 'reference');
	t.is(t.context.validator.errors.length, 5);
	t.context.validator.validateType(new Date('December 17, 1995 03:24:00'), 'address_id', { type: 'reference' });
	t.is(t.context.validator.errors.length, 6);

	t.context.validator.validateType(17, 'is_member', 'boolean');
	t.is(t.context.validator.errors.length, 7);
	t.context.validator.validateType('Steve', 'is_member', 'boolean');
	t.is(t.context.validator.errors.length, 8);
	t.context.validator.validateType('no', 'is_member', { type: 'boolean' });
	t.is(t.context.validator.errors.length, 9);

	t.context.validator.validateType(false, 'dob', 'date');
	t.is(t.context.validator.errors.length, 10);
	t.context.validator.validateType(false, 'dob', { type: 'date' });
	t.is(t.context.validator.errors.length, 11);
});


/* validateValues */

test('validates correct value against value list', t => {
	t.context.validator.validateValues('foo', 'qux', { values: ['foo', 'bar', 'baz'] });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateValues('foo', 'qux', {});
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateValues('', 'qux', { values: ['foo', 'bar', 'baz'] });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateValues('', 'qux', { default: 'foo', values: ['foo', 'bar', 'baz'] });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateValues('', 'qux', { required: false, values: ['foo', 'bar', 'baz'] });
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates incorrect value against value list', t => {
	t.context.validator.validateValues('quux', 'qux', { values: ['foo', 'bar', 'baz'] });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateValues('fooo', 'qux', { values: ['foo', 'bar', 'baz'] });
	t.is(t.context.validator.errors.length, 2);

	t.context.validator.validateValues('', 'qux', { required: true, values: ['foo', 'bar', 'baz'] });
	t.is(t.context.validator.errors.length, 3);
});


/* validateMaxlen */

test('validates correct value against maximum length', t => {
	t.context.validator.validateMaxlen('foo', 'qux', { maxlen: 10 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMaxlen('foo', 'qux', { maxlen: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMaxlen('', 'qux', { maxlen: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMaxlen('', 'qux', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates incorrect value against maximum length', t => {
	t.context.validator.validateMaxlen('foofoofoofoo', 'qux', { maxlen: 10 });
	t.is(t.context.validator.errors.length, 1);
});


/* validateMinlen */

test('validates correct value against minimum length', t => {
	t.context.validator.validateMinlen('foofoofoo', 'qux', { minlen: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMinlen('foo', 'qux', { minlen: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMinlen('foo', 'qux', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates incorrect value against minimum length', t => {
	t.context.validator.validateMinlen('f', 'qux', { minlen: 3 });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateMinlen('', 'qux', { minlen: 3 });
	t.is(t.context.validator.errors.length, 2);
});


/* validateMax */

test('validates correct value against maximum value', t => {
	t.context.validator.validateMax(5, 'qux', { max: 10 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMax(3, 'qux', { max: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMax('', 'qux', { max: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMax(0, 'qux', { max: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMax('', 'qux', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates incorrect value against maximum value', t => {
	t.context.validator.validateMax(15, 'qux', { max: 10 });
	t.is(t.context.validator.errors.length, 1);
});


/* validateMin */

test('validates correct value against minimum value', t => {
	t.context.validator.validateMin(5, 'qux', { min: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMin(3, 'qux', { min: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMin('', 'qux', { min: 3 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateMin(3, 'qux', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates incorrect value against minimum value', t => {
	t.context.validator.validateMin(2, 'qux', { min: 3 });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateMin(0, 'qux', { min: 3 });
	t.is(t.context.validator.errors.length, 2);
});


/* validateEmail */

test('validates correct email address', t => {
	t.context.validator.validateEmail('john@example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('john@example.co.uk', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('john.smith@example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('john.smith@sub.example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('john.smith+filter@example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('123@example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('john@123example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('john_smith@example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateEmail('', 'email', { email: true });
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates incorrect email address', t => {
	t.context.validator.validateEmail('john@example.123', 'email', { email: true });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateEmail('example.com', 'email', { email: true });
	t.is(t.context.validator.errors.length, 2);

	t.context.validator.validateEmail('john@example', 'email', { email: true });
	t.is(t.context.validator.errors.length, 3);

	t.context.validator.validateEmail('123', 'email', { email: true });
	t.is(t.context.validator.errors.length, 4);

	t.context.validator.validateEmail(false, 'email', { email: true });
	t.is(t.context.validator.errors.length, 5);
});


/* validateFileMaxsize */

test('validates valid file against maximum file size', t => {
	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: 4194304 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: '4G' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: '4M' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2048 }, 'attachment', { maxsize: '4K' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 8 }, 'attachment', { maxsize: '16B' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: '4g' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: '4m' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2048 }, 'attachment', { maxsize: '4k' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 8 }, 'attachment', { maxsize: '16b' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: '4.5M' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: true });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxsize({ size: 2097152 }, 'attachment', { maxsize: 'M4' });
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates invalid file against maximum file size', t => {
	t.context.validator.validateFileMaxsize({ size: 4194304 }, 'attachment', { maxsize: 2097152 });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateFileMaxsize({ size: 4294967296 }, 'attachment', { maxsize: '2G' });
	t.is(t.context.validator.errors.length, 2);

	t.context.validator.validateFileMaxsize({ size: 4194304 }, 'attachment', { maxsize: '2M' });
	t.is(t.context.validator.errors.length, 3);

	t.context.validator.validateFileMaxsize({ size: 4096 }, 'attachment', { maxsize: '2K' });
	t.is(t.context.validator.errors.length, 4);

	t.context.validator.validateFileMaxsize({ size: 16 }, 'attachment', { maxsize: '8B' });
	t.is(t.context.validator.errors.length, 5);

	t.context.validator.validateFileMaxsize({ size: 4294967296 }, 'attachment', { maxsize: '2g' });
	t.is(t.context.validator.errors.length, 6);

	t.context.validator.validateFileMaxsize({ size: 4194304 }, 'attachment', { maxsize: '2m' });
	t.is(t.context.validator.errors.length, 7);

	t.context.validator.validateFileMaxsize({ size: 4096 }, 'attachment', { maxsize: '2k' });
	t.is(t.context.validator.errors.length, 8);

	t.context.validator.validateFileMaxsize({ size: 16 }, 'attachment', { maxsize: '8b' });
	t.is(t.context.validator.errors.length, 9);

	t.context.validator.validateFileMaxsize({ size: 4194304 }, 'attachment', { maxsize: '2.5M' });
	t.is(t.context.validator.errors.length, 10);
});


/* validateFileType */

test('validates valid file against file type', t => {
	t.context.validator.validateFileType({ group: 'image' }, 'attachment', { filetype: 'image' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ mimetype: 'image/jpeg' }, 'attachment', { filetype: 'image/jpeg' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ extension: 'jpg' }, 'attachment', { filetype: 'jpg' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ group: 'image' }, 'attachment', { filetype: ['image', 'video'] });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ mimetype: 'image/jpeg' }, 'attachment', { filetype: ['image/jpeg', 'image/png'] });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ extension: 'jpg' }, 'attachment', { filetype: ['jpg', 'png'] });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ group: 'image' }, 'attachment', {});
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ mimetype: 'image/jpeg' }, 'attachment', {});
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ extension: 'jpg' }, 'attachment', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates invalid file against file type', t => {
	t.context.validator.validateFileType({ group: 'video' }, 'attachment', { filetype: 'image' });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateFileType({ mimetype: 'image/png' }, 'attachment', { filetype: 'image/jpeg' });
	t.is(t.context.validator.errors.length, 2);

	t.context.validator.validateFileType({ extension: 'png' }, 'attachment', { filetype: 'jpg' });
	t.is(t.context.validator.errors.length, 3);

	t.context.validator.validateFileType({ group: 'document' }, 'attachment', { filetype: ['image', 'video'] });
	t.is(t.context.validator.errors.length, 4);

	t.context.validator.validateFileType({ mimetype: 'image/webp' }, 'attachment', { filetype: ['image/jpeg', 'image/png'] });
	t.is(t.context.validator.errors.length, 5);

	t.context.validator.validateFileType({ extension: 'webp' }, 'attachment', { filetype: ['jpg', 'png'] });
	t.is(t.context.validator.errors.length, 6);
});

test('validates valid file against file type with wildcards', t => {
	t.context.validator.validateFileType({ mimetype: 'image/jpeg' }, 'attachment', { filetype: 'image/*' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ mimetype: 'video/ogg' }, 'attachment', { filetype: '*/ogg' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ extension: 'jpg' }, 'attachment', { filetype: '*p*' });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileType({ group: 'image' }, 'attachment', { filetype: '*age' });
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates invalid file against file type with wildcards', t => {
	t.context.validator.validateFileType({ mimetype: 'video/ogg' }, 'attachment', { filetype: 'image/*' });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateFileType({ mimetype: 'image/jpeg' }, 'attachment', { filetype: '*/ogg' });
	t.is(t.context.validator.errors.length, 2);

	t.context.validator.validateFileType({ extension: 'gif' }, 'attachment', { filetype: '*p*' });
	t.is(t.context.validator.errors.length, 3);

	t.context.validator.validateFileType({ group: 'video' }, 'attachment', { filetype: '*age' });
	t.is(t.context.validator.errors.length, 4);
});


/* validateFileMinwidth */

test('validates valid image file against minimum width', t => {
	t.context.validator.validateFileMinwidth({ width: 1000 }, 'attachment', { minwidth: 500 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMinwidth({ width: 500 }, 'attachment', { minwidth: 500 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMinwidth({ width: 500 }, 'attachment', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates invalid image file against minimum width', t => {
	t.context.validator.validateFileMinwidth({ width: 400 }, 'attachment', { minwidth: 500 });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateFileMinwidth({ width: 0 }, 'attachment', { minwidth: 500 });
	t.is(t.context.validator.errors.length, 2);
});


/* validateFileMaxwidth */

test('validates valid image file against maximum width', t => {
	t.context.validator.validateFileMaxwidth({ width: 1000 }, 'attachment', { maxwidth: 1000 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxwidth({ width: 500 }, 'attachment', { maxwidth: 1000 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxwidth({ width: 500 }, 'attachment', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates invalid image file against maximum width', t => {
	t.context.validator.validateFileMaxwidth({ width: 1000 }, 'attachment', { maxwidth: 500 });
	t.is(t.context.validator.errors.length, 1);
});


/* validateFileMinheight */

test('validates valid image file against minimum height', t => {
	t.context.validator.validateFileMinheight({ height: 1000 }, 'attachment', { minheight: 500 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMinheight({ height: 500 }, 'attachment', { minheight: 500 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMinheight({ height: 500 }, 'attachment', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates invalid image file against minimum height', t => {
	t.context.validator.validateFileMinheight({ height: 400 }, 'attachment', { minheight: 500 });
	t.is(t.context.validator.errors.length, 1);

	t.context.validator.validateFileMinheight({ height: 0 }, 'attachment', { minheight: 500 });
	t.is(t.context.validator.errors.length, 2);
});


/* validateFileMaxheight */

test('validates valid image file against maximum height', t => {
	t.context.validator.validateFileMaxheight({ height: 1000 }, 'attachment', { maxheight: 1000 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxheight({ height: 500 }, 'attachment', { maxheight: 1000 });
	t.is(t.context.validator.errors.length, 0);

	t.context.validator.validateFileMaxheight({ height: 500 }, 'attachment', {});
	t.is(t.context.validator.errors.length, 0);
});

test('invalidates invalid image file against maximum height', t => {
	t.context.validator.validateFileMaxheight({ height: 1000 }, 'attachment', { maxheight: 500 });
	t.is(t.context.validator.errors.length, 1);
});
