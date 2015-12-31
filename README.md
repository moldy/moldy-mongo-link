# moldy-mongo-link
Link Mongo connections together using Moldy.

## Schema
Schema is similar to [json hyper-schema](http://json-schema.org/latest/json-schema-hypermedia.html) but is designed for use on the backend rather than the frontend.

Links are defined in the "custom" section of a schema as `linksLinkType` entries where `LinkType` is an arbitrary link name, eg. 'CreatedBy'.

Each link is defined as an array of related schemas and conditions which link them together. You can have multiple types of links to express any number of different relationships.

Links are configured as MongoDB queries. The simplest may just be key/pair values, but advanced features such as `$elemMatch` etc are supported.

## Schema example
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

The schema specifies an author with an id, name and description. Each author also has a link to the "book" collection, where the `authorId` is equal to the current author's ID and the `published` flag is set to "true".

In this case, providing `moldy-mongo-link` an instantiated author object will return the author's information, as well as a list of all the author's published works.

## Mongo $in

Special considerations are made around the MongoDB `$in` operator. When using
$in in moldy-mongo-link, you can use either of the following syntax:

Manual array construction:
```
"where": {
  "somekey": {
    $in: ["<%= key1 %>", "<%= key2 %>"]
  }
}
```

Map-based construction:
```
"where": {
  "somekey": {
    $in: {
      "from": "myObjects",
      "to": "<%= objectId %>"
    }
  }
}
```

The map-based construction will perform an `Array.map`  on the "from" object, and
return value of the "to" expression per line.

## JSON references
By default moldy-mongo-link returns all the values in a "references" object
adjacent to the provided data object, however it also supports JSON references
when configured.

You can configure JSON references by providing a "jsonref" key in your link
configuration:

```
  "linksPets": [ {
    "type": "animals",
    "where": {
      "owner": "<%= personId %>"
    },
    "jsonref": "animalId"
  }
```

This creates a JSON Reference that points to `#/references/animals/:animalId`
and can be resolved by a JSON Reference library.

When using a `$in` operator, the reference must be specified inside the $in
object, in order to apply to each of the mapped objects:

```
"$in": {
  "from": "servicePlan",
  "to": "<%= planId %>",
  "jsonref": "planId"
}
```

## Usage
Parameters:
- moldyObject - An instantiated moldy object to find the links for.
- schemas - An object containing all the required Moldy models.
- linkType - Type of link to search for in the schema. Eg. `PublishedWorks`

Example:

```
fetchDependencies( {
    moldyObject: userMoldy, // After a $findOne
    linkType: 'All',        // Corresponds with linkAll
    schemas: self.model,
}, function( _error, _jsonWithDependencies ) {} )
```
