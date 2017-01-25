var riak = require("riak-js");
var ff = require("ff");
var path = require("path");
var Class = require("./Class");

function getKey (p) {
	return "fs:" + p.split("/").join(":");
}

var FS = Class.extend({
	init: function (opts) {
		console.log("INIT", opts)
		this.bucket = opts.name;
		this.db = riak.getClient();
	},

	readFile: function (file, next) {
		this.db.get(this.bucket, getKey(file), {}, function (err, item) {
			if (err) next([{message: "Could not find file `" + file + "`."}]);
			else next(null, item);
		}.bind(this));
	},

	writeFile: function (file, body, next) {
		var name = path.basename(file);
		var dir = path.dirname(file);

		var f = ff(this, function () {
			this.exists(file, f.slotPlain());
		}, function (exists) {
			if (!exists) {
				var f2 = ff(this, function () {
					this.readdir(dir, f2.slot());	
				}, function (dirs) {
					if (!Array.isArray(dirs)) {
						dirs = [];
					}

					dirs.push(name);
					this.db.save(this.bucket, getKey(dir), dirs, f2.slot());
				}).cb(f.slot())
			}
		}, function () {
			this.db.save(this.bucket, getKey(file), body, {}, f.slot());	
		}).cb(next);
	},

	exists: function (file, next) {
		this.db.get(this.bucket, getKey(file), {}, function (err, item) {
			next(!err);
		}.bind(this));	
	},

	unlink: function (file, next) {
		var name = path.basename(file);
		var dir = path.dirname(file);

		var f = ff(this, function () {
			this.readdir(dir, f.slot());
		}, function (dirs) {
			var idx = dirs.indexOf(name)
			if (idx != -1) {
				dirs.splice(idx, 1);
				this.db.save(this.bucket, getKey(dir), dirs);
			}

			this.db.remove(this.bucket, getKey(file), f.slot());
		}).cb(next);
	},

	readdir: function (file, next) {
		console.log(this.bucket, file, getKey(file))
		this.db.get(this.bucket, getKey(file), {}, function (err, item) {
			if (err) next(null, []);
			else next(null, item);
		}.bind(this));
	},

	readdirRecursive: function (file, next) {
		var f = ff(this, function () {
			this.readdir(file, f.slot());
		}, function (files) {
			f.pass(files);
			var group = f.group();

			for (var i = 0; i < files.length; ++i) {
				if (files[i].indexOf(".") == -1) {
					this.readdir(path.join(file, files[i]), group());
				}
			}
		}, function (files, subfiles) {
			// move subfiles into files
			var j = 0;
			for (var i = 0; i < files.length; ++i) {
				if (files[i].indexOf(".") == -1) {
					files = files.concat(subfiles[j++].map(function (x) {
						return files[i] + '/' + x;
					}));
				}
			}

			f.pass(files);
		}).cb(next);
	},

	mkdir: function (file, next) {
		var name = path.basename(file);
		var dir = path.dirname(file);

		var f = ff(this, function () {
			this.readdir(dir, f.slot());
		}, function (dirs) {
			var idx = dirs.indexOf(name)
			if (idx == -1) {
				dirs.push(name);
				this.db.save(this.bucket, getKey(dir), dirs);
			}
		}, function () {
			this.db.save(this.bucket, getKey(file), [], f.slot());	
		}).cb(next);
	},

	rmdir: function (file, next) {
		var name = path.basename(file);
		var dir = path.dirname(file);

		var f = ff(this, function () {
			this.readdir(dir, f.slot());
		}, function (dirs) {
			var idx = dirs.indexOf(name)
			if (idx != -1) {
				dirs.splice(idx, 1);
				this.db.save(this.bucket, getKey(dir), dirs);
			}
		}, function () {
			this.db.remove(this.bucket, getKey(file), f.slot());
		}).cb(next);	
	}
});

module.exports = FS;
