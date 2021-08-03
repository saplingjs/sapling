/**
 * Hash
 *
 * Hash a given password
 */

/* Dependencies */
import crypto from 'node:crypto';

import SaplingError from './SaplingError.js';


/**
 * The Hash class
 */
export default class Hash {
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
		if (length) {
			this.length = length;
		}

		if (iterations) {
			this.iterations = iterations;
		}
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
		if (arguments.length === 2) {
			/* Throw errors if arguments are missing */
			if (!password) {
				throw new SaplingError('Password missing');
			}

			if (!salt) {
				throw new SaplingError('Salt missing');
			}

			/* Hash the password, return error or the hash */
			return new Promise((resolve, reject) => {
				crypto.pbkdf2(password, salt, this.iterations, this.length, 'sha256', (error, key) => {
					if (error) {
						reject(new SaplingError(error));
					} else {
						resolve(key.toString('base64'));
					}
				});
			});
		}

		/* Throw errors if argument is missing */
		if (!password) {
			throw new SaplingError('Password missing');
		}

		return new Promise((resolve, reject) => {
			crypto.randomBytes(this.length, (error, salt) => {
				/* Return any error */
				if (error) {
					return reject(new SaplingError(error));
				}

				/* Hash password */
				salt = salt.toString('base64');
				crypto.pbkdf2(password, salt, this.iterations, this.length, 'sha256', (error, hash) => {
					/* Return any error */
					if (error) {
						return reject(new SaplingError(error));
					}

					/* Send an array with salt and hashed password */
					resolve([salt, hash.toString('base64')]);
				});
			});
		});
	}
}
