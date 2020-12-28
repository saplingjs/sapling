/**
 * Hash
 * 
 * Hash a given password
 */

'use strict';

/* Dependencies */
const { console } = require("./Cluster");
const SaplingError = require("./SaplingError");

let crypto;
try {
	crypto = require('crypto');
} catch (err) {
	console.error(new SaplingError('Cannot load required dependency: `crypto`'));
	process.exit();
}


module.exports = class Hash {

	/* Bytesize */
	length = 128;


	/* Iterations (~300ms) */
	iterations = 12000;


	/**
	 * Initialise the Hash class
	 * 
	 * @param {int} length Bytesize
	 * @param {int} iterations Iterations
	 */
	constructor(length, iterations) {
		if(length) this.length = length;
		if(iterations) this.iterations = iterations;
	}


	/**
	 * Hashes a password with optional `salt`, otherwise
	 * generate a salt for `pass` and return an array with
	 * salt and hash.
	 *
	 * @param {string} password The password to hash
	 * @param {string} salt Optional pre-existing salt
	 */
	async hash(password, salt) {
		/* If we're using an existing salt */
		if (arguments.length == 2) {
			/* Throw errors if arguments are missing */
			if (!password) return new SaplingError('Password missing');
			if (!salt) return new SaplingError('Salt missing');

			/* Hash the password, return error or the hash */
			return new Promise((resolve, reject) => {
				crypto.pbkdf2(password, salt, this.iterations, this.length, 'sha256', (err, key) => {
					err ? reject(new SaplingError(err)) : resolve(key);
				});
			});
		} else {
			/* Throw errors if argument is missing */
			if (!password) return new SaplingError('Password missing');

			return new Promise((resolve, reject) => {
				crypto.randomBytes(this.length, (err, salt) => {
					/* Return any error */
					if (err) return reject(new SaplingError(err));

					/* Hash password */
					salt = salt.toString('base64');
					crypto.pbkdf2(password, salt, this.iterations, this.length, 'sha256', (err, hash) => {
						/* Return any error */
						if (err) return reject(new SaplingError(err));
						
						/* Send an array with salt and hashed password */
						resolve([salt, hash.toString('base64')]);
					});
				});
			});
		}
	}
};
