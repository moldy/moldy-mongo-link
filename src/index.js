var extend = require( 'extend' );
ejs = require( 'ejs' ),
	async = require( 'async' ),
	bson = require( 'bson' );

function performSubstitutions( value, data, parent ) {
	if ( typeof value === 'object' ) {
		Object.keys( value ).forEach( function ( _key ) {
			if ( value[ _key ] instanceof Array ) {
				value[ _key ] = value[ _key ].map( function ( _arrayItem ) {
					return performSubstitutions( _arrayItem, data );
				} );
			} else if ( typeof value[ _key ] === 'object' ) {
				value[ _key ] = performSubstitutions( value[ _key ], data, _key );
			} else {
				value[ _key ] = ejs.compile( value[ _key ] )( data );
				// Parse string $in values to get the values out + remove empties.
				if ( _key === '$in' ) {
					value[ _key ] = value[ _key ].split( ',' ).filter(function(_item){
						return _item;
					});
				}
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
	var moldyObject = _options.moldyObject;
	if ( !moldyObject ) return _callback();
	var schemas = _options.schemas;
	var moldy = moldyObject.__moldy;
	var data = moldyObject.$json();
	var linkTagName = 'links' + _options.linkType;
	var references = _options.references || {};
	_options.dependencies = _options.dependencies || {};

	// If there's no custom fields, don't do anything.
	if ( !moldy.__custom || !moldy.__custom[ linkTagName ] ) {
		return _callback( null, _options.references ? {
			data: data
		} : data );
	}

	// Load up the links we need to resolve.
	var links = extend( true, {}, moldy.__custom[ 'links' + _options.linkType ] );


	// For each link we want to resolve, we need to query it recursively.
	// This is kicked off below in the async.eachSeries
	function fetchEachLink( _link, _done ) {
		// Pick out the new Moldy model.
		var schema = schemas[ _link.type ];
		if ( !schema ) return _done( new Error( 'Schema ' + _link.type + ' not defined' ) );
		_options.dependencies[ _link.type ] = _options.dependencies[ _link.type ] || {};

		// Create our query based on the linked structure.
		var query = {};
		Object.keys( _link.where ).forEach( function ( _key ) {
			// Parse values with ejs so we can pull values off 'this'.
			query[ _key ] = performSubstitutions( _link.where[ _key ], data, _key );
		} );

		// Don't requery this thing if we've done it before. (Quick way to prevent loops.)
		var queryKey = _link.type + JSON.stringify( query );
		if ( references[ queryKey ] ) return _done();
		references[ queryKey ] = true;

		// only $findOne has id to ObjectId conversion.
		var findMethod;
		if ( query.id && query.id.$in && query.id.$in instanceof Array ) {
			// Encode MongoDB IDs in a $in statement.
			findMethod = '$find';
			query._id = query.id;
			delete query.id;
			query._id.$in = query._id.$in.map( function ( _item ) {
				return bson.ObjectId( _item );
			} );
		} else {
			findMethod = query.id && !query.id.$in ? '$findOne' : '$find';
		}

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
					references: references,
					dependencies: _options.dependencies
				}, _eDone );
			}, function ( _error, _links ) {
				if ( _error ) return _done( _error );
				// Add each dependency-resolved item into the parent object.
				Object.keys( _links ).filter( function ( _key ) {
					return _links[ _key ] && _links[ _key ].data;
				} ).forEach( function ( _key ) {
					_options.dependencies[ _link.type ][ _links[ _key ].data.id ] =  _links[ _key ].data;
				} );
				_done( _error, _options.dependencies );
			} );
		} );

	}

	// Once all the links have been resolved, return 'em.
	function onceFetchCompleted( _error ) {
		if ( _options.dependencies ) {
			_callback( _error, {
				data: data,
				references: _options.dependencies
			} );
		} else {
			_callback( _error, data );
		}
	}

	// Start the search.
	async.eachSeries( links, fetchEachLink, onceFetchCompleted );
};
