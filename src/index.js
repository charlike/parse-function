/*!
 * parse-function <https://github.com/tunnckoCore/parse-function>
 *
 * Copyright (c) 2017 Charlike Mike Reagent <open.source.charlike@gmail.com> (https://i.am.charlike.online)
 * Released under the MIT license.
 */

/**
 * Utilities
 */

import utils from './lib/utils.js'

/**
 * Core plugins
 */

import initial from './lib/plugins/initial.js'

/**
 * > Initializes with optional `opts` object which is passed directly
 * to the desired parser and returns an object
 * with `.use` and `.parse` methods. The default parse which
 * is used is [babylon][]'s `.parseExpression` method from `v7`.
 *
 * @example
 * const parseFunction = require('parse-function')
 *
 * const app = parseFunction({
 *   ecmaVersion: 2017
 * })
 *
 * const fixtureFn = (a, b, c) => {
 *   a = b + c
 *   return a + 2
 * }
 *
 * const result = app.parse(fixtureFn)
 * console.log(result)
 *
 * // see more
 * console.log(result.name) // => null
 * console.log(result.isNamed) // => false
 * console.log(result.isArrow) // => true
 * console.log(result.isAnonymous) // => true
 *
 * // array of names of the arguments
 * console.log(result.args) // => ['a', 'b', 'c']
 *
 * // comma-separated names of the arguments
 * console.log(result.params) // => 'a, b, c'
 *
 * @param  {Object} opts optional, merged with options passed to `.parse` method
 * @return {Object} `app` object with `.use` and `.parse` methods
 * @name   parseFunction
 * @public
 */
export default function parseFunction (opts) {
  const plugins = []
  const app = {
    /**
     * > Parse a given `code` and returns a `result` object
     * with useful properties - such as `name`, `body` and `args`.
     * By default it uses Babylon parser, but you can switch it by
     * passing `options.parse` - for example `options.parse: acorn.parse`.
     * In the below example will show how to use `acorn` parser, instead
     * of the default one.
     *
     * @example
     * const acorn = require('acorn')
     * const parseFn = require('parse-function')
     * const app = parseFn()
     *
     * const fn = function foo (bar, baz) { return bar * baz }
     * const result = app.parse(fn, {
     *   parse: acorn.parse,
     *   ecmaVersion: 2017
     * })
     *
     * console.log(result.name) // => 'foo'
     * console.log(result.args) // => ['bar', 'baz']
     * console.log(result.body) // => ' return bar * baz '
     * console.log(result.isNamed) // => true
     * console.log(result.isArrow) // => false
     * console.log(result.isAnonymous) // => false
     * console.log(result.isGenerator) // => false
     *
     * @param  {Function|String} code any kind of function or string to be parsed
     * @param  {Object} options directly passed to the parser - babylon, acorn, espree
     * @param  {Function} options.parse by default `babylon.parseExpression`,
     *                                    all `options` are passed as second argument
     *                                    to that provided function
     * @return {Object} `result` see [result section](#result) for more info
     * @name   .parse
     * @public
     */
    parse: (code, options) => {
      let result = utils.setDefaults(code)

      if (!result.isValid) {
        return result
      }

      opts = Object.assign({}, opts, options)

      const isFunction = result.value.startsWith('function')
      const isAsyncFn = result.value.startsWith('async function')
      const isAsyncArrow = result.value.startsWith('async')
        && result.value.includes('=>')
      // eslint-disable-next-line no-useless-escape
      const isMethod = /^\*?.+\([\s\S\w\W]*\)\s*\{/i.test(result.value)

      if (!(isFunction || isAsyncFn || isAsyncArrow) && isMethod) {
        result.value = `{ ${result.value} }`
      }

      let node = utils.getNode(result, opts)
      return plugins.reduce((res, fn) => fn(node, res) || res, result)
    },

    /**
     * > Add a plugin `fn` function for extending the API or working on the
     * AST nodes. The `fn` is immediately invoked and passed
     * with `app` argument which is instance of `parseFunction()` call.
     * That `fn` may return another function that
     * accepts `(node, result)` signature, where `node` is an AST node
     * and `result` is an object which will be returned [result](#result)
     * from the `.parse` method. This retuned function is called on each
     * node only when `.parse` method is called.
     *
     * _See [Plugins Architecture](#plugins-architecture) section._
     *
     * @example
     * // plugin extending the `app`
     * app.use((app) => {
     *   app.define(app, 'hello', (place) => `Hello ${place}!`)
     * })
     *
     * const hi = app.hello('World')
     * console.log(hi) // => 'Hello World!'
     *
     * // or plugin that works on AST nodes
     * app.use((app) => (node, result) => {
     *   if (node.type === 'ArrowFunctionExpression') {
     *     result.thatIsArrow = true
     *   }
     *   return result
     * })
     *
     * const result = app.parse((a, b) => (a + b + 123))
     * console.log(result.name) // => null
     * console.log(result.isArrow) // => true
     * console.log(result.thatIsArrow) // => true
     *
     * const result = app.parse(function foo () { return 123 })
     * console.log(result.name) // => 'foo'
     * console.log(result.isArrow) // => false
     * console.log(result.thatIsArrow) // => undefined
     *
     * @param  {Function} fn plugin to be called
     * @return {Object} `app` instance for chaining
     * @name   .use
     * @public
     */
    use: (fn) => {
      const ret = fn(app)
      if (typeof ret === 'function') {
        plugins.push(ret)
      }
      return app
    },

    /**
     * > Define a non-enumerable property on an object. Just
     * a convenience mirror of the [define-property][] library,
     * so check out its docs. Useful to be used in plugins.
     *
     * @example
     * const parseFunction = require('parse-function')
     * const app = parseFunction()
     *
     * // use it like `define-property` lib
     * const obj = {}
     * app.define(obj, 'hi', 'world')
     * console.log(obj) // => { hi: 'world' }
     *
     * // or define a custom plugin that adds `.foo` property
     * // to the end result, returned from `app.parse`
     * app.use((app) => {
     *   return (node, result) => {
     *     // this function is called
     *     // only when `.parse` is called
     *
     *     app.define(result, 'foo', 123)
     *
     *     return result
     *   }
     * })
     *
     * // fixture function to be parsed
     * const asyncFn = async (qux) => {
     *   const bar = await Promise.resolve(qux)
     *   return bar
     * }
     *
     * const result = app.parse(asyncFn)
     *
     * console.log(result.name) // => null
     * console.log(result.foo) // => 123
     * console.log(result.args) // => ['qux']
     *
     * console.log(result.isAsync) // => true
     * console.log(result.isArrow) // => true
     * console.log(result.isNamed) // => false
     * console.log(result.isAnonymous) // => true
     *
     * @param  {Object} obj the object on which to define the property
     * @param  {String} prop the name of the property to be defined or modified
     * @param  {Any} val the descriptor for the property being defined or modified
     * @return {Object} `obj` the passed object, but modified
     * @name   .define
     * @public
     */
    define: utils.define,
  }

  app.use(initial)

  return app
}
