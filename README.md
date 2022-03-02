# Price Transparency Machine-readable File Validator

This tool is used to validate machine-readable files in JSON format against the [schemas published by CMS](https://github.com/CMSgov/price-transparency-guide).

## Installation

### Prerequisites

- Node
- NPM
- Git
- Docker

### Instructions

Clone this repository using Git in the desired installation location:

```
git clone https://github.com/CMSgov/price-transparency-guide-validator.git
```

From the directory containing the clone, build the validator Docker image:

```
docker build -t validator .
```

Install the dependencies for and build the Node script:

```
npm install
npm run build
```

## Usage

The validator is run from the cloned directory. For basic usage instructions:

```
node . help
```

```
Tool for validating health coverage machine-readable files.

Options:
  -h, --help                                       display help for command

Commands:
  validate [options] <data-file> <schema-version>  Validate a file against a specific published version of a CMS schema.
  update                                           Update the available schemas from the CMS repository.
  help [command]                                   display help for command
```

### Validate a file

Validating a file against one of the provided schemas is the primary usage of this tool. Be sure that you have the latest schemas available by [running the update command](#update-available-schemas) first.

From the installed directory:

```
node . validate <data-file> <schema-version> [-o out] [-t target]
```

Example usages:

```bash
# basic usage, printing output directly and using the default in-network-rates schema
node . validate my-data.json v1.0.0
# output will be written to a file. validate using allowed-amounts schema
node . validate my-data.json v1.0.0 -o results.txt -t allowed-amounts
```

Further details:

```
Validate a file against a specific published version of a CMS schema.

Arguments:
  data-file              path to data file to validate
  schema-version         version of schema to use for validation

Options:
  -o, --out <out>        output path
  -t, --target <schema>  name of schema to use (choices: "allowed-amounts", "in-network-rates", "provider-reference",
                         "table-of-contents", default: "in-network-rates")
  -h, --help             display help for command
```

### Update available schemas

In order to perform validation, schemas must be available to the validator tool. The latest schemas can be obtained using the update command.

From the installed directory:

```
node . update
```
