# supertest-scy

[![Build Status](https://travis-ci.org/scy/supertest-scy.png?branch=master)](https://travis-ci.org/scy/supertest-scy)

These are my extensions to [SuperTest](https://github.com/visionmedia/supertest).

## Features

### JSON Schema validation

supertest-scy uses [tv4](http://geraintluff.github.io/tv4/) to implement the new method `expectSchema`. This can be used to check the JSON document returned against a [JSON Schema](http://json-schema.org/).

    request(app)
    	.get("/whatever")
    	.expect(200)
    	.expectSchema({
    		type: "object",
    		required: [ "id", "value" ]
    	})
    	.end(done)

### Append request and response contents to stack trace

When a test fails, the stack trace displayed by Mocha (or whatever you use) won't contain information about the request itself. I mean, it's good to see that you got an HTTP 500 instead of the expected 200, but what was the error message? What was the data you sent in that request?

supertest-scy keeps track of the currently running request and, on error, appends all relevant information to the stack trace: request URL, headers, and body as well as response headers and body. You don't need to do anything to enable this, it just works.

Since that information can be quite a lot of output, the maximum length of attached response body data can be limited:

    // Limit to 500 characters, the default.
    supertest.setMaxBodyDump(500);
    
    // Disable the limit.
    supertest.setMaxBodyDump(Infinity);

It would be useful if all of the requests were written to a file for later analysis, but this is currently not implemented.

### Easy HTTP Basic auth, defaults possible

To easily use HTTP Basic authentication in your calls, you can use the `auth()` method, which also supports setting defaults:

    var supertest = require("supertest-scy");
    
    // Simple authed request.
    supertest(app)
    	.get("/whatever")
    	.auth("user", "pass")
    	.expect(200)
    	.end(done)
    
    // Set default credentials.
    supertest.defaultCredentials("user", "pass");
    
    // Use default credentials.
    supertest(app)
    	.get("/whatever")
    	.auth()
    	.expect(200)
    	.end(done)

### Show request/response data for certain tests

There is a convenience wrapper that you can use to log information about any request, for example to show what is actually sent to or received from the server. This information is part of the request dump that's appended to the stack trace of failed test (see above), but using this wrapper you can do that for tests that don't fail as well. Simply use `.end(supertest.debug(done))` instead of a plain `.end(done)`.

### Methods for generating random strings

First of all, these are not perfect, but they work for me. You can access them using `supertest.methodName()`. Here are some examples for all methods that exist:

    var supertest = require("supertest-scy");
    
    supertest.getRandomChar("asdff")
    // Returns either "a", "s", "d" or "f", with "f" being twice as likely to be
    // returned than the others.
    
    supertest.generateRandomString(5, "abc", "def", "ghi")
    // Returns a string that's 5 characters long and consists of one of "abc",
    // then three of "def" (duplicates can happen), then one of "ghi", so for
    // example "bdedg".
    
    supertest.generateRandomString(5, "abc", "def")
    // Equivalent to (5, "abc", "def", "def").
    
    supertest.generateRandomString(5, "abc")
    // Equivalent to (5, "abc", "abc", "abc").
    
    supertest.generateRandomLengthString(5, 10, "abc", "def", "ghi")
    // Calls generateRandomString with a count parameter between 5 and 10,
    // inclusive. The strings are passed unmodified. You can omit some of them
    // in the same way.
    
    supertest.generateConservativeDomain()
    // Returns a domain with top and second-level part, e.g. "xyzzy.wtf". (Yes,
    // the TLD is a random string, but only 2 or 3 characters long.)
    
    supertest.generateLiberalDomain()
    // Returns a domain with a random number of parts, which have a random
    // length as well. There is no check for the maxium length of the whole
    // string. (Which is possibly a bug.)
    
    supertest.generateConservativeEmail()
    // Returns an e-mail address with a valid local part and a "conservative"
    // domain.

### Shortcut for sending form data

We define `request(foo).sendForm(data)`, which is just a shortcut for `request(foo).type("form").send(data)`.

## Thoughts

### Extension vs. fork

Instead of forking SuperTest and implementing the new features there, this project chose to extend the SuperTest code by messing around with the functions and objects it defines. This is a bit clumsy sometimes, but works surprisingly well. If TJ Holowaychuk is interested, I can integrate some or all of the supertest-scy features in SuperTest. However, this would introduce more dependencies and more code, and since SuperTest is quite minimal, I'm not sure whether he's interested in that.

### The stability of the request dumps

To do these request dumps, supertest-scy wraps the original `.get()`, `.post()` etc. methods and keeps track of the most recent one using a module-global variable. And if a test returns an error, `attachCurrentRequestToError()` is called to attach a string representation of the request and response to the stack trace.

This feels terribly unstable, and as soon as multiple requests would run simultaneously, it would break horribly. But at least in the large test suite I developed supertest-scy for, it works surprisingly well.

I'm not sure whether there's a better way to do this, but as long as it works, I don't care.

What's bugging me more is that it's not easy to get all the data from SuperAgent's objects. I have to access internal objects and stuff like that, see `renderRequest()`. I'd love to have a better solution for that.

## Author

Written by [Tim Weber](http://scy.name/) for a project at [Cocomore](http://www.cocomore.com/). Please don't judge me for the lack of code beauty, the team was waiting for their test framework. ;)
