# Price Transparency Machine-readable File Validator

This tool is used to validate [Transparency in Coverage](https://www.cms.gov/priorities/key-initiatives/healthplan-price-transparency) machine-readable files in JSON format against the [schemas published by CMS](https://github.com/CMSgov/price-transparency-guide).

## Installation

### Prerequisites

- Node (version 16.x)
- NPM (version 8.5.x)
- Git (latest version recommended, tested using 2.27.0)
- Docker (version 19.x)

### Included Libraries

- [RapidJSON](https://rapidjson.org)
- [TCLAP](https://tclap.sourceforge.net)

### Instructions

Clone this repository using Git in the desired installation location:

```bash
git clone --recurse-submodules https://github.com/CMSgov/price-transparency-guide-validator.git
```

> **Hint**
>
> This repository references 3rd-party C++ libraries using Git submodules. If you clone without the `--recurse-submodules` flag, just run inside the repo:
>
> ```bash
> git submodule update --init
> ```

Make sure that Docker is running:

```bash
docker ps
```

If this shows a table of active containers and their resource usage, then Docker is active.

From the directory containing the clone, build the validator Docker image:

```bash
cd price-transparency-guide-validator
docker build -t validator .
```

Install the Node script with the `-g` global flag so it can be run from any location:

```
npm install -g cms-mrf-validator
```

## Usage

The validator can be run from any directory. For basic usage instructions:

```
cms-mrf-validator help
```

```
Tool for validating health coverage machine-readable files.

Options:
  -d, --debug                                      show debug output
  -h, --help                                       display help for command

Commands:
  validate [options] <data-file>  Validate a file against a specific published version of a CMS schema.
  from-url [options] <data-url>   Validate the file retrieved from a URL against a specific published version of a CMS schema.
  update                          Update the available schemas from the CMS repository.
  help [command]                  display help for command
```

### Update available schemas

In order to perform validation, schemas must be available to the validator tool. The latest schemas can be obtained using the update command.

From the installed directory:

```
cms-mrf-validator update
```

### Validate a file

Validating a file against one of the provided schemas is the primary usage of this tool. Be sure that you have the latest schemas available by [running the update command](#update-available-schemas) first.

From the installed directory:

```
cms-mrf-validator validate <data-file> [options]
```

Example usages:

```bash
# basic usage, printing output directly and using the default in-network-rates schema with the version specified in the file
cms-mrf-validator validate my-data.json
# output will be written to a file. validate using specific version of allowed-amounts schema
cms-mrf-validator validate my-data.json --schema-version v1.0.0 -o results.txt -t allowed-amounts
```

Further details:

```
Validate a file against a specific published version of a CMS schema.

Arguments:
  data-file                   path to data file to validate

Options:
  --schema-version <version>  version of schema to use for validation
  -o, --out <out>             output path
  -t, --target <schema>       name of schema to use (choices: "allowed-amounts", "in-network-rates", "provider-reference", "table-of-contents",
                              default: "in-network-rates")
  -s, --strict                enable strict checking, which prohibits additional properties in data file
  -y, --yes-all               automatically respond "yes" to confirmation prompts
  -h, --help                  display help for command
```

The purpose of the `strict` option is to help detect when an optional attribute has been spelled incorrectly. Because additional properties are allowed by the schema, a misspelled optional attribute does not normally cause a validation failure.

### Validate a file at a URL

It is also possible to specify a URL to the file to validate. From the installed directory:

```
cms-mrf-validator from-url <data-url> [options]
```

The only difference in arguments is that a URL should be provided instead of a path to a file. All options from the `validate` command still apply. The URL must return a file that is one of the following:

- a JSON file
- a GZ-compressed JSON file
- a ZIP archive that contains a JSON file. If multiple JSON files are found within the ZIP archive, you can choose which one you want to validate.

Further details:

```
Validate the file retrieved from a URL against a specific published version of a CMS schema.

Arguments:
  data-url                    URL to data file to validate

Options:
  --schema-version <version>  version of schema to use for validation
  -o, --out <out>             output path
  -t, --target <schema>       name of schema to use (choices: "allowed-amounts", "in-network-rates", "provider-reference", "table-of-contents",
                              default: "in-network-rates")
  -s, --strict                enable strict checking, which prohibits additional properties in data file
  -y, --yes-all               automatically respond "yes" to confirmation prompts
  -h, --help                  display help for command
```

### Test file validation

This project contains sample JSON files that can be used to familiarize yourself with the validation tool. These examples can be found in the [`test-files`](https://github.com/CMSgov/price-transparency-guide-validator/tree/documentation/test-files) directory.

Running the command from the root of the project:

#### Running a valid file:

```bash
cms-mrf-validator validate test-files/in-network-rates-fee-for-service-sample.json --schema-version v1.0.0
```

Output:

```
Input JSON is valid.
```

#### Running an invalid file:

```bash
cms-mrf-validator validate test-files/allowed-amounts-error.json --schema-version v1.0.0 -t allowed-amounts
```

Output:

```bash
Input JSON is invalid.
Error Name: type
Message: Property has a type 'integer' that is not in the following list: 'string'.
Instance: #/out_of_network/0/allowed_amounts/0/service_code/3
Schema: #/definitions/allowed_amounts/properties/service_code/items


Invalid schema: #/definitions/allowed_amounts/properties/service_code/items
Invalid keyword: type
Invalid code: 20
Invalid message: Property has a type '%actual' that is not in the following list: '%expected'.
Invalid document: #/out_of_network/0/allowed_amounts/0/service_code/3
Error report:
{
    "type": {
        "expected": [
            "string"
        ],
        "actual": "integer",
        "errorCode": 20,
        "instanceRef": "#/out_of_network/0/allowed_amounts/0/service_code/3",
        "schemaRef": "#/definitions/allowed_amounts/properties/service_code/items"
    }
}
```

### Performance Considerations

This validation tool is based on [rapidjson](https://rapidjson.org/) which is a high performance C++ JSON parser. You can find various benchmarks on [rapidjson's site](https://rapidjson.org/md_doc_performance.html) that should give the user an idea on what to expect when using.

The exact amount of time needed for the validator to run will vary based on input file size and the machine running the validator. On a sample system with a 2.60GHz CPU and 16GB of memory, a typical processing rate is approximately 25 megabytes of input per second.
