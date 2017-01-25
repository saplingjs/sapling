//save reference to prototype methods
var slice = Array.prototype.slice;
var spaceRegex = /\s+/;

//helper method to create extend functions on widgets
function createExtend (parent) {
	return function (opts) {
		var cls = function () {
			if (this instanceof cls) {
				this.init && this.init.apply(this, arguments);	
			} else {
				cls.super.apply(cls, arguments);
			}
		};

		//we don't want to use the original constructor
		//or else it will call `init`
		function Dummy(){}
  		Dummy.prototype = parent.prototype;

		//extend the prototype with the widget
		cls.prototype = new Dummy;
		cls.prototype.constructor = cls;

		//give access to the parent class
		cls.super = function (ctx, method, args) {
			parent.prototype[method].apply(ctx, args);
		};

		//give an extend function to this class
		cls.extend = createExtend(cls);

		//extend the class with these options
		for (var key in opts)
			cls.prototype[key] = opts[key];

		cls.prototype.super = cls.super;//parent.prototype;
		return cls;
	};
}

/**
* Base class.
*/
var Class = function () {
	this.tag = "Class";
	this.init && this.init.apply(this, arguments);
};

Class.prototype = {
	init: function () {
		this._handlers = {};
	},

	on: function (evt, cb) {
		if (spaceRegex.test(evt)) {
			//if delimetered by a space, call on
			//for every event.
			var evts = evt.split(spaceRegex);
			for (var i = 0; i < evts.length; ++i)
				this.on(evts[i], cb);

			return this;
		}

		//define callbacks with an object
		if (typeof evt === "object") {
			//key is the event name, value is the
			//callback function
			for (var evtName in evt)
				this.on(evtName, evt[evtName]);
		}

		if (!this._handlers[evt])
			this._handlers[evt] = [];

		this._handlers[evt].push(cb);
		return this;
	},

	off: function (evt, cb) {
		//remove every handler
		if (!evt && !cb) {
			this._handlers = {};
			return this;
		}

		if (!cb) {
			//remove every handler with that name
			this._handlers[evt] = [];
		} else {
			var handlers = this._handlers[evt] || [];

			//find the exact handler
			for (var i = handlers.length; i >= 0; --i) {
				if (handlers[i] === cb) {
					handlers.splice(i, 1);
				}
			}
		}

		return this;
	},

	emit: function (evt) {
		//save all the arguments except the first one
		var args = slice.call(arguments, 1);
		var node = this;

		//if there is a colon, emit wildcards
		if (evt.indexOf(":") !== -1) {
			var evtSplat = evt.split(":");
			var wildcard = evtSplat[0] + ":*";
			
			//don't emit wildcard if already a wildcard
			if (evtSplat[1] !== "*") {
				var wildArgs = slice.call(arguments, 0);
				wildArgs[0] = wildcard;
				
				this.emit.apply(this, wildArgs);
			}
		}
		
		do {
			//execute the handlers
			if (!node._handlers || !node._handlers[evt]) continue;

			for (var i = 0; i < node._handlers[evt].length; ++i) {
				//skip if the value is not executable
				if (typeof node._handlers[evt][i] !== "function")
					continue;

				node._handlers[evt][i].apply(node, args);
			}
		} while (node = node.parent);

		return this;
	},

	once: function (evt, cb) {
		this.on(evt, function temp () {
			cb && cb.apply(this, arguments);
			this.off(evt, temp);
		});

		return this;
	}
};

//setup event aliases
Class.prototype.bind = Class.prototype.subscribe = Class.prototype.on;
Class.prototype.unbind = Class.prototype.unsubscribe = Class.prototype.off;
Class.prototype.trigger = Class.prototype.publish = Class.prototype.emit;

Class.extend = createExtend(Class);

module.exports = Class;