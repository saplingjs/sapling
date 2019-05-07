# Sapling Framework

## Installation Guide

**1. Clone the repo in your project folder**

Make sure the directory is named `sapling` and exists in your project directory.

For unix-like systems (e.g. OSX, BSD, Linux) you may use the command-line tool. You must link it to your path by running the following:

	cd /path/to/sapling
	./sapling.sh link

**2. Install the dependencies and modules**

- Node.js v8, npm

Run the following in a terminal:
	
	cd /path/to/project
	sapling modules

or in Windows run `windows/install.bat`

**3. Create the necessary files**

Inside the project directory:

	D  models/
	D  views/
	   controller.js
	   config.js
	   permissions.js

or use the command-line tool to generate them:

	cd /path/to/project
	sapling init

**4. Run the server**
	
	cd /path/to/project
	sapling serve

or on Windows run `windows/start-server.bat`


## Error codes


### Validation

1001: Field is required, but no value was provided.

1002: Field is provided, but it's the wrong type.

1003: Field is provided, but it's not one of the enumerated acceptable values.

1004: Input is too long.

1005: Input is too short.

1006: Input is too big.

1007: Input is too small.

1008: Input is not a valid email address.

1009: Input is not the correct password.

1010: Model does not exist.


### Authorization & Access

4001: Invalid username or password.

4002: User is not logged in.

4003: Recovery key has expired.

4004: Recovery key is invalid.