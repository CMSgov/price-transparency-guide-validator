// Schema Validator example

// The example validates JSON text from stdin with a JSON schema specified in the argument.

#define RAPIDJSON_HAS_STDSTRING 1

#include "rapidjson/include/rapidjson/error/en.h"
#include "rapidjson/include/rapidjson/filereadstream.h"
#include "rapidjson/include/rapidjson/schema.h"
#include "rapidjson/include/rapidjson/stringbuffer.h"
#include "rapidjson/include/rapidjson/prettywriter.h"
#include <tclap/CmdLine.h>
#include <string>
#include <iostream>
#include <sstream>
#include <stdio.h>
#include <stdlib.h>

using namespace rapidjson;

typedef GenericValue<UTF8<>, CrtAllocator > ValueType;

// Forward ref
static void CreateErrorMessages(const ValueType& errors, FILE* outFile,  size_t depth, const char* context);

// Convert GenericValue to std::string
static std::string GetString(const ValueType& val) {
  std::ostringstream s;
  if (val.IsString())
    s << val.GetString();
  else if (val.IsDouble())
    s << val.GetDouble();
  else if (val.IsUint())
   s << val.GetUint();
  else if (val.IsInt())
    s << val.GetInt();
  else if (val.IsUint64())
    s << val.GetUint64();
  else if (val.IsInt64())
    s <<  val.GetInt64();
  else if (val.IsBool() && val.GetBool())
    s << "true";
  else if (val.IsBool())
    s << "false";
  else if (val.IsFloat())
    s << val.GetFloat();
  return s.str();}

// Create the error message for a named error
// The error object can either be empty or contain at least member properties:
// {"errorCode": <code>, "instanceRef": "<pointer>", "schemaRef": "<pointer>" }
// Additional properties may be present for use as inserts.
// An "errors" property may be present if there are child errors.
static void HandleError(const char* errorName, const ValueType& error, FILE* outFile, size_t depth, const char* context) {
  if (!error.ObjectEmpty()) {
    // Get error code and look up error message text (English)
    int code = error["errorCode"].GetInt();
    std::string message(GetValidateError_En(static_cast<ValidateErrorCode>(code)));
    // For each member property in the error, see if its name exists as an insert in the error message and if so replace with the stringified property value
    // So for example - "Number '%actual' is not a multiple of the 'multipleOf' value '%expected'." - we would expect "actual" and "expected" members.
    for (ValueType::ConstMemberIterator insertsItr = error.MemberBegin();
      insertsItr != error.MemberEnd(); ++insertsItr) {
      std::string insertName("%");
      insertName += insertsItr->name.GetString(); // eg "%actual"
      size_t insertPos = message.find(insertName);
      if (insertPos != std::string::npos) {
        std::string insertString("");
        const ValueType &insert = insertsItr->value;
        if (insert.IsArray()) {
          // Member is an array so create comma-separated list of items for the insert string
          for (ValueType::ConstValueIterator itemsItr = insert.Begin(); itemsItr != insert.End(); ++itemsItr) {
            if (itemsItr != insert.Begin()) insertString += ",";
            insertString += GetString(*itemsItr);
          }
        } else {
          insertString += GetString(insert);
        }
        message.replace(insertPos, insertName.length(), insertString);
      }
    }
    // Output error message, references, context
    std::string indentStr(depth * 2, ' ');
    const char *indent = indentStr.c_str();
    fprintf(outFile, "%sError Name: %s\n", indent, errorName);
    fprintf(outFile, "%sMessage: %s\n", indent, message.c_str());
    fprintf(outFile, "%sInstance: %s\n", indent, error["instanceRef"].GetString());
    fprintf(outFile, "%sSchema: %s\n", indent, error["schemaRef"].GetString());
    if (depth > 0) {
        fprintf(outFile, "%sContext: %s\n", indent, context);
    }
    fprintf(outFile, "\n");

    // If child errors exist, apply the process recursively to each error structure.
    // This occurs for "oneOf", "allOf", "anyOf" and "dependencies" errors, so pass the error name as context.
    if (error.HasMember("errors")) {
      depth++;
      const ValueType &childErrors = error["errors"];
      if (childErrors.IsArray()) {
        // Array - each item is an error structure - example
        // "anyOf": {"errorCode": ..., "errors":[{"pattern": {"errorCode\": ...\"}}, {"pattern": {"errorCode\": ...}}]
        for (ValueType::ConstValueIterator errorsItr = childErrors.Begin();
             errorsItr != childErrors.End(); ++errorsItr) {
          CreateErrorMessages(*errorsItr, outFile, depth, errorName);
        }
      } else if (childErrors.IsObject()) {
        // Object - each member is an error structure - example
        // "dependencies": {"errorCode": ..., "errors": {"address": {"required": {"errorCode": ...}}, "name": {"required": {"errorCode": ...}}}
        for (ValueType::ConstMemberIterator propsItr = childErrors.MemberBegin();
             propsItr != childErrors.MemberEnd(); ++propsItr) {
          CreateErrorMessages(propsItr->value, outFile, depth, errorName);
        }
      }
    }
  }
}

// Create error message for all errors in an error structure
// Context is used to indicate whether the error structure has a parent 'dependencies', 'allOf', 'anyOf' or 'oneOf' error
static void CreateErrorMessages(const ValueType& errors, FILE* outFile, size_t depth = 0, const char* context = 0) {
    // Each member property contains one or more errors of a given type
    for (ValueType::ConstMemberIterator errorTypeItr = errors.MemberBegin(); errorTypeItr != errors.MemberEnd(); ++errorTypeItr) {
        const char* errorName = errorTypeItr->name.GetString();
        const ValueType& errorContent = errorTypeItr->value;
        if (errorContent.IsArray()) {
            // Member is an array where each item is an error - eg "type": [{"errorCode": ...}, {"errorCode": ...}]
            for (ValueType::ConstValueIterator contentItr = errorContent.Begin(); contentItr != errorContent.End(); ++contentItr) {
                HandleError(errorName, *contentItr, outFile, depth, context);
            }
        } else if (errorContent.IsObject()) {
            // Member is an object which is a single error - eg "type": {"errorCode": ... }
            HandleError(errorName, errorContent, outFile, depth, context);
        }
    }
}

int main(int argc, char *argv[]) {
    std::string schemaPath;
    std::string dataPath;
    std::string outputPath;
    int bufferSize = 4069;

    try {
      TCLAP::CmdLine cmd("validator for machine-readable files", ' ', "0.1");
      TCLAP::UnlabeledValueArg<std::string> schemaArg("schema-path", "path to schema file", true, "", "path");
      TCLAP::UnlabeledValueArg<std::string> dataArg("data-path", "path to data file", true, "", "path");
      TCLAP::ValueArg<std::string> outputArg("o", "output-path", "path to output file", false, "", "path");
      TCLAP::ValueArg<int> bufferArg("b", "buffer-size", "buffer size in bytes", false, 4069, "integer");
      TCLAP::ValueArg<std::string> versionArg("s", "schema-version", "schema version to validate against", false, "0.8.0", "version string");
      cmd.add(schemaArg);
      cmd.add(dataArg);
      cmd.add(outputArg);
      cmd.add(versionArg);
      cmd.add(bufferArg);
      cmd.parse(argc, argv);
      schemaPath = schemaArg.getValue();
      dataPath = dataArg.getValue();
      outputPath = outputArg.getValue();
      bufferSize = bufferArg.getValue();
    } catch (TCLAP::ArgException &e) {
      fprintf(stderr, e.error().c_str());
      return EXIT_FAILURE;
    }

    // if an output file is specified, try to open it for writing
    FILE *outFile;
    FILE *errFile;
    bool fileOutput = false;
    if (outputPath.length() > 0) {
        outFile = fopen(outputPath.c_str(), "w");
        if (!outFile) {
            printf("Could not open file '%s' for output\n", outputPath);
            return -1;
        }
        errFile = outFile;
        fileOutput = true;
    } else {
      outFile = stdout;
      errFile = stderr;
    }

    // Read a JSON schema from file into Document
    Document d;
    char buffer[bufferSize];

    {
        FILE *fp = fopen(schemaPath.c_str(), "r");
        std::string cmd("cat ");
        cmd += schemaPath;
        if (!fp) {
            fprintf(outFile, "Schema file '%s' not found\n", schemaPath);
            if (fileOutput) {
                fclose(outFile);
            }
            return -1;
        }
        FileReadStream fs(fp, buffer, sizeof(buffer));
        d.ParseStream(fs);
        if (d.HasParseError()) {
            fprintf(errFile, "Schema file '%s' is not a valid JSON\n", schemaPath);
            fprintf(errFile, "Error(offset %u): %s\n",
                static_cast<unsigned>(d.GetErrorOffset()),
                GetParseError_En(d.GetParseError()));
            fclose(fp);
            if (fileOutput) {
                fclose(outFile);
            }
            return EXIT_FAILURE;
        }
        fclose(fp);
    }
    
    // Then convert the Document into SchemaDocument
    SchemaDocument sd(d);

    // Use reader to parse the JSON in stdin, and forward SAX events to validator
    SchemaValidator validator(sd);
    Reader reader;
    FILE *fp2 = fopen(dataPath.c_str(), "r");
    if (!fp2) {
        fprintf(outFile, "JSON file '%s' not found\n", dataPath);
        if (fileOutput) {
            fclose(outFile);
        }
        return -1;
    }
    FileReadStream is(fp2, buffer, sizeof(buffer));
    if (!reader.Parse(is, validator) && reader.GetParseErrorCode() != kParseErrorTermination) {
        // Schema validator error would cause kParseErrorTermination, which will handle it in next step.
        fprintf(errFile, "Input is not a valid JSON\n");
        fprintf(errFile, "Error(offset %u): %s\n",
            static_cast<unsigned>(reader.GetErrorOffset()),
            GetParseError_En(reader.GetParseErrorCode()));
    }

    // Check the validation result
    if (validator.IsValid()) {
        fprintf(outFile, "Input JSON is valid.\n");
        if (fileOutput) {
            fclose(outFile);
        }
        return EXIT_SUCCESS;
    }
    else {
        fprintf(outFile, "Input JSON is invalid.\n");
        StringBuffer sb;
        validator.GetInvalidSchemaPointer().StringifyUriFragment(sb);
        fprintf(errFile, "Invalid schema: %s\n", sb.GetString());
        fprintf(errFile, "Invalid keyword: %s\n", validator.GetInvalidSchemaKeyword());
        fprintf(errFile, "Invalid code: %d\n", validator.GetInvalidSchemaCode());
        fprintf(errFile, "Invalid message: %s\n", GetValidateError_En(validator.GetInvalidSchemaCode()));
        sb.Clear();
        validator.GetInvalidDocumentPointer().StringifyUriFragment(sb);
        fprintf(errFile, "Invalid document: %s\n", sb.GetString());
        // Detailed violation report is available as a JSON value
        sb.Clear();
        PrettyWriter<StringBuffer> w(sb);
        validator.GetError().Accept(w);
        fprintf(errFile, "Error report:\n%s\n", sb.GetString());
        CreateErrorMessages(validator.GetError(), outFile);
        if (fileOutput) {
            fclose(outFile);
        }
        return EXIT_FAILURE;
    }
}
