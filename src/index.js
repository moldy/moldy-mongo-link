function performSubstitutions( value, data ) {
	var ejs = require( 'ejs' );
	if ( typeof value === 'object' ) {
		Object.keys( value ).forEach( function ( _key ) {
			if ( value[ _key ] instanceof Array ) {
				value[ _key ] = value[ _key ].map( function ( _arrayItem ) {
					return performSubstitutions( _arrayItem, data );
				} );
			} else if ( typeof value[ _key ] === 'object' ) {
				value[ _key ] = performSubstitutions( value[ _key ], data );
			} else {
				value[ _key ] = ejs.compile( value[ _key ] )( data );
			}
		} );
	} else {
		value = ejs.compile( value )( data );
	}
	return value;
}

/**
 * Resolve Moldy dependencies
 * @param {Object} _options -
 * @param {Moldy}  _options.moldyObject - An instantiated moldy object to find the links for.
 * @param {Object} _options.schemas -     An object containing all the required Moldy models.
 * @param {string} _options.linkType -    Type of link to search for in the schema.
 * @param {object} _options.references -  Internal use only, pass references in to prevent duplicate queries.
 * @example
 * fetchDependencies( {
 * 	moldyObject: userMoldy, // After a $findOne
 * 	linkType: 'All',        // Corresponds with linkAll
 * 	schemas: self.model,
 * }, function( _error, _jsonWithDependencies ) {} )
 */
var fetchDependencies = module.exports = function ( _options, _callback ) {
	var async = require( 'async' );
	var moldyObject = _options.moldyObject;
	var schemas = _options.schemas;
	var moldy = moldyObject.__moldy;
	var data = moldyObject.$json();
	var linkTagName = 'links' + _options.linkType;
	var references = _options.references || {};

	// If there's no custom fields, don't do anything.
	if ( !moldy.__custom || !moldy.__custom[ linkTagName ] ) {
		return _callback( null, _options.references ? {
			data: data
		} : data );
	}

	// Load up the links we need to resolve.
	var links = moldy.__custom[ 'links' + _options.linkType ];
	data[ linkTagName ] = {};

	// For each link we want to resolve, we need to query it recursively.
	// This is kicked off below in the async.eachSeries
	function fetchEachLink( _link, _done ) {
		// Pick out the new Moldy model.
		var schema = schemas[ _link.type ];
		if ( !schema ) return _done( new Error( 'Schema ' + _link.type + ' not defined' ) );

		// Create our query based on the linked structure.
		var query = {};
		Object.keys( _link.where ).forEach( function ( _key ) {
			// Parse values with ejs so we can pull values off 'this'.
			query[ _key ] = performSubstitutions( _link.where[ _key ], data );
		} );

		// Don't requery this thing if we've done it before. (Quick way to prevent loops.)
		if ( references[ JSON.stringify( query ) ] ) return _done();
		references[ JSON.stringify( query ) ] = true;

		// only $findOne has id to ObjectId conversion.
		var findMethod = query.id ? '$findOne' : '$find';

		schema[ findMethod ]( query, function ( _error, _items ) {
			if ( _error ) return _done( _error );
			if ( _items instanceof Array === false ) _items = [ _items ];
			if ( _items.length === 0 ) return _done();

			// Check each item that was returned for further dependencies.
			async.map( _items, function ( _item, _eDone ) {
				fetchDependencies( {
					moldyObject: _item,
					linkType: _options.linkType,
					schemas: _options.schemas,
					references: references
				}, _eDone );
			}, function ( _error, _links ) {
				// Add each dependency-resolved item into the parent object.
				data[ linkTagName ][ _link.type ] = _links.map( function ( _link ) {
					return _link.data;
				} );
				_done( _error, _links );
			} );
		} );

	}

	// Once all the links have been resolved, return 'em.
	function onceFetchCompleted( _error ) {
		if ( _options.references ) {
			_callback( _error, {
				data: data,
				references: references
			} );
		} else {
			_callback( _error, data );
		}
	}

	// Start the search.
	async.eachSeries( links, fetchEachLink, onceFetchCompleted );
};
