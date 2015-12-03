moldy-mongo-link
================

Link Mongo connections together using Moldy.

Schema
------

Schema is similar to [json hyper-schema](http://json-schema.org/latest/json-schema-hypermedia.html)
but is designed for use on the backend rather than the frontend.

Links are defined in the "custom" section of a schema as `linksLinkType` entries
where `LinkType` is an arbitrary link name, eg. 'CreatedBy'.

Each link is defined as an array of related schemas and conditions which link
them together. You can have multiple types of links to express any number of
different relationships.

Schema example
--------------

Consider the following schema of `author.json`:

```
{
    "properties": {
        "id": "string",
        "name": "string",
        "description": "string"
    },
    "custom": {
        "linksPublishedWorks": [{
            "type": "book",
            "where": {
                "authorId": "<%- id %>",
								"published": true
            }
        }]
    }
}
```

The schema specifies an author with an id, name and description. Each author
also has a link to the "book" collection, where the `authorId` is equal to the
current author's ID and the `published` flag is set to "true".

In this case, providing `moldy-mongo-link` an instantiated author object will
return the author's information, as well as a list of all the author's published
works.

Usage
-----

Parameters:

* moldyObject - An instantiated moldy object to find the links for.
* schemas - An object containing all the required Moldy models.
* linkType - Type of link to search for in the schema. Eg. `PublishedWorks`

Example:

```
fetchDependencies( {
	moldyObject: userMoldy, // After a $findOne
	linkType: 'All',        // Corresponds with linkAll
	schemas: self.model,
}, function( _error, _jsonWithDependencies ) {} )
```
