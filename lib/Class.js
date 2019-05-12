//save reference to prototype methods
const slice = Array.prototype.slice;
const spaceRegex = /\s+/;

//helper method to create extend functions on widgets
function createExtend({prototype}) {
	return opts => {
        class cls extends Dummy {
            constructor(...args) {
                if (this instanceof cls) {
                    this.init && this.init(...args);	
                } else {
                    cls.super(...args);
                }
            }
        }

        //we don't want to use the original constructor
        //or else it will call `init`
        function Dummy(){}
        Dummy.prototype = prototype;

        //give access to the parent class
        cls.super = (ctx, method, args) => {
			prototype[method].apply(ctx, args);
		};

        //give an extend function to this class
        cls.extend = createExtend(cls);

        //extend the class with these options
        for (const key in opts)
			cls.prototype[key] = opts[key];

        cls.prototype.super = cls.super;//parent.prototype;
        return cls;
    };
}

/**
* Base class.
*/
class Class {
    constructor(...args) {
        this.tag = "Class";
        this.init && this.init(...args);
    }

    init() {
		this._handlers = {};
	}

    on(evt, cb) {
		if (spaceRegex.test(evt)) {
			//if delimetered by a space, call on
			//for every event.
			const evts = evt.split(spaceRegex);
			for (let i = 0; i < evts.length; ++i)
				this.on(evts[i], cb);

			return this;
		}

		//define callbacks with an object
		if (typeof evt === "object") {
			//key is the event name, value is the
			//callback function
			for (const evtName in evt)
				this.on(evtName, evt[evtName]);
		}

		if (!this._handlers[evt])
			this._handlers[evt] = [];

		this._handlers[evt].push(cb);
		return this;
	}

    off(evt, cb) {
		//remove every handler
		if (!evt && !cb) {
			this._handlers = {};
			return this;
		}

		if (!cb) {
			//remove every handler with that name
			this._handlers[evt] = [];
		} else {
			const handlers = this._handlers[evt] || [];

			//find the exact handler
			for (let i = handlers.length; i >= 0; --i) {
				if (handlers[i] === cb) {
					handlers.splice(i, 1);
				}
			}
		}

		return this;
	}

    emit(evt) {
		//save all the arguments except the first one
		const args = slice.call(arguments, 1);
		let node = this;

		//if there is a colon, emit wildcards
		if (evt.includes(":")) {
			const evtSplat = evt.split(":");
			const wildcard = `${evtSplat[0]}:*`;
			
			//don't emit wildcard if already a wildcard
			if (evtSplat[1] !== "*") {
				const wildArgs = slice.call(arguments, 0);
				wildArgs[0] = wildcard;
				
				this.emit(...wildArgs);
			}
		}
		
		do {
			//execute the handlers
			if (!node._handlers || !node._handlers[evt]) continue;

			for (let i = 0; i < node._handlers[evt].length; ++i) {
				//skip if the value is not executable
				if (typeof node._handlers[evt][i] !== "function")
					continue;

				node._handlers[evt][i].apply(node, args);
			}
		} while (node = node.parent);

		return this;
	}

    once(evt, cb) {
		this.on(evt, function temp () {
			cb && cb.apply(this, arguments);
			this.off(evt, temp);
		});

		return this;
	}
}

//setup event aliases
Class.prototype.bind = Class.prototype.subscribe = Class.prototype.on;
Class.prototype.unbind = Class.prototype.unsubscribe = Class.prototype.off;
Class.prototype.trigger = Class.prototype.publish = Class.prototype.emit;

Class.extend = createExtend(Class);

module.exports = Class;