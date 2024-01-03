// Schema Validator example

// The example validates JSON text from stdin with a JSON schema specified in the argument.

#define RAPIDJSON_HAS_STDSTRING 1

#include "rapidjson/include/rapidjson/error/en.h"
#include "rapidjson/include/rapidjson/filereadstream.h"
#include "rapidjson/include/rapidjson/filewritestream.h"
#include "rapidjson/include/rapidjson/schema.h"
#include "rapidjson/include/rapidjson/reader.h"
#include "rapidjson/include/rapidjson/stringbuffer.h"
#include "rapidjson/include/rapidjson/prettywriter.h"
#include <tclap/CmdLine.h>
#include <string>
#include <iostream>
#include <sstream>
#include <stdio.h>
#include <stdlib.h>
#include <filesystem>

using namespace rapidjson;
using namespace std;

typedef GenericValue<UTF8<>, CrtAllocator> ValueType;

// Forward ref
static void CreateErrorMessages(const ValueType &errors, FILE *outFile, size_t depth, const char *context);

// Convert GenericValue to std::string
static std::string GetString(const ValueType &val)
{
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
    s << val.GetInt64();
  else if (val.IsBool() && val.GetBool())
    s << "true";
  else if (val.IsBool())
    s << "false";
  else if (val.IsFloat())
    s << val.GetFloat();
  return s.str();
}

// Create the error message for a named error
// The error object can either be empty or contain at least member properties:
// {"errorCode": <code>, "instanceRef": "<pointer>", "schemaRef": "<pointer>" }
// Additional properties may be present for use as inserts.
// An "errors" property may be present if there are child errors.
static void HandleError(const char *errorName, const ValueType &error, FILE *outFile, size_t depth, const char *context)
{
  if (!error.ObjectEmpty())
  {
    // Get error code and look up error message text (English)
    int code = error["errorCode"].GetInt();
    std::string message(GetValidateError_En(static_cast<ValidateErrorCode>(code)));
    // For each member property in the error, see if its name exists as an insert in the error message and if so replace with the stringified property value
    // So for example - "Number '%actual' is not a multiple of the 'multipleOf' value '%expected'." - we would expect "actual" and "expected" members.
    for (ValueType::ConstMemberIterator insertsItr = error.MemberBegin();
         insertsItr != error.MemberEnd(); ++insertsItr)
    {
      std::string insertName("%");
      insertName += insertsItr->name.GetString(); // eg "%actual"
      size_t insertPos = message.find(insertName);
      if (insertPos != std::string::npos)
      {
        std::string insertString("");
        const ValueType &insert = insertsItr->value;
        if (insert.IsArray())
        {
          // Member is an array so create comma-separated list of items for the insert string
          for (ValueType::ConstValueIterator itemsItr = insert.Begin(); itemsItr != insert.End(); ++itemsItr)
          {
            if (itemsItr != insert.Begin())
              insertString += ",";
            insertString += GetString(*itemsItr);
          }
        }
        else
        {
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
    if (depth > 0)
    {
      fprintf(outFile, "%sContext: %s\n", indent, context);
    }
    fprintf(outFile, "\n");

    // If child errors exist, apply the process recursively to each error structure.
    // This occurs for "oneOf", "allOf", "anyOf" and "dependencies" errors, so pass the error name as context.
    if (error.HasMember("errors"))
    {
      depth++;
      const ValueType &childErrors = error["errors"];
      if (childErrors.IsArray())
      {
        // Array - each item is an error structure - example
        // "anyOf": {"errorCode": ..., "errors":[{"pattern": {"errorCode\": ...\"}}, {"pattern": {"errorCode\": ...}}]
        for (ValueType::ConstValueIterator errorsItr = childErrors.Begin();
             errorsItr != childErrors.End(); ++errorsItr)
        {
          CreateErrorMessages(*errorsItr, outFile, depth, errorName);
        }
      }
      else if (childErrors.IsObject())
      {
        // Object - each member is an error structure - example
        // "dependencies": {"errorCode": ..., "errors": {"address": {"required": {"errorCode": ...}}, "name": {"required": {"errorCode": ...}}}
        for (ValueType::ConstMemberIterator propsItr = childErrors.MemberBegin();
             propsItr != childErrors.MemberEnd(); ++propsItr)
        {
          CreateErrorMessages(propsItr->value, outFile, depth, errorName);
        }
      }
    }
  }
}

// Create error message for all errors in an error structure
// Context is used to indicate whether the error structure has a parent 'dependencies', 'allOf', 'anyOf' or 'oneOf' error
static void CreateErrorMessages(const ValueType &errors, FILE *outFile, size_t depth = 0, const char *context = 0)
{
  // Each member property contains one or more errors of a given type
  for (ValueType::ConstMemberIterator errorTypeItr = errors.MemberBegin(); errorTypeItr != errors.MemberEnd(); ++errorTypeItr)
  {
    const char *errorName = errorTypeItr->name.GetString();
    const ValueType &errorContent = errorTypeItr->value;
    if (errorContent.IsArray())
    {
      // Member is an array where each item is an error - eg "type": [{"errorCode": ...}, {"errorCode": ...}]
      for (ValueType::ConstValueIterator contentItr = errorContent.Begin(); contentItr != errorContent.End(); ++contentItr)
      {
        HandleError(errorName, *contentItr, outFile, depth, context);
      }
    }
    else if (errorContent.IsObject())
    {
      // Member is an object which is a single error - eg "type": {"errorCode": ... }
      HandleError(errorName, errorContent, outFile, depth, context);
    }
  }
}

string objectPathToString(list<string> &objectPath)
{
  string result = "";
  if (objectPath.size() > 0)
  {
    for (const auto pathPart : objectPath)
    {
      if (pathPart != "[]")
      {
        result.append(".");
      }
      result.append(pathPart);
    }
  }
  return result;
}

string objectPathToString(list<pair<string, int>> &objectPath, string lastPart)
{
  string result = "";
  bool firstSegment = true;
  if (objectPath.size() == 0)
  {
    return result;
  }
  else
  {
    for (const auto pathPart : objectPath)
    {
      if (pathPart.first == "[]")
      {
        result.append("[");
        result.append(to_string(pathPart.second));
        result.append("]");
      }
      else
      {
        if (firstSegment)
        {
          firstSegment = false;
        }
        else
        {
          result.append(".");
        }

        result.append(pathPart.first);
      }
    }
  }
  if (lastPart != "")
  {
    if (!firstSegment)
    {
      result.append(".");
    }

    result.append(lastPart);
  }
  return result;
}

struct ItemCounter
{
  string schemaName;
  list<string> path;
  int count;
};

struct ItemReporter
{
  string schemaName;
  list<string> path;
  list<string> values;
  list<string> locations;
};

struct MessageHandler : public BaseReaderHandler<UTF8<>, MessageHandler>
{
  static list<string> providerReferencePath;
  static list<string> tocInNetworkPath;
  static list<string> tocAllowedAmountPath;
  static list<string> negotiatedPricePath;
  static list<string> additionalInfoPath;
  static list<string> inNetworkProviderGroupsPath;

  enum State
  {
    traversingObject,
    expectGenericKey,
    expectGenericValue
  } state_;
  list<string> objectPath;
  list<pair<string, int>> objectPathWithArrayIndices;
  list<string> inNetworkLocations;
  list<string> additionalLocations;
  list<ItemCounter> pathsForCounting;
  list<ItemReporter> pathsForReporting;
  ItemReporter *currentReport;
  string lastKey;
  string schemaName;
  PrettyWriter<FileWriteStream> *reportWriter;

  MessageHandler(string name, PrettyWriter<FileWriteStream> &reportFile)
  {
    inNetworkLocations = {};
    additionalLocations = {};
    objectPath = {};
    state_ = traversingObject;
    schemaName = name;
    // pathsForCounting = {{.schemaName = "in-network-rates", .path = negotiatedPricePath, .count = 0},
    //                     {.schemaName = "in-network-rates", .path = additionalInfoPath, .count = 0}};
    pathsForCounting = {};
    pathsForReporting = {{.schemaName = "in-network-rates", .path = additionalInfoPath, .values = {}, .locations = {}},
                         {.schemaName = "in-network-rates", .path = inNetworkProviderGroupsPath, .values = {}, .locations = {}},
                         {.schemaName = "table-of-contents", .path = tocAllowedAmountPath, .values = {}, .locations = {}},
                         {.schemaName = "table-of-contents", .path = tocInNetworkPath, .values = {}, .locations = {}}};
    reportWriter = &reportFile;
    reportWriter->StartObject();
    currentReport = NULL;
  }

  ~MessageHandler()
  {
    if (reportWriter != NULL)
    {
      reportWriter->Flush();
    }
  }

  void CleanupWriter()
  {
    if (reportWriter != NULL)
    {
      reportWriter->EndObject();
      reportWriter->Flush();
    }
  }

  bool Key(const Ch *str, SizeType len, bool copy)
  {
    lastKey = string(str);
    // check all counted things
    // when processing a key, we can check paths that end with a key name
    // for (auto &ic : pathsForCounting)
    // {
    //   if (schemaName == ic.schemaName && ic.path.back() != "[]" && almostThere(ic.path))
    //   {
    //     printf("found a count item by key! %s\n", objectPathToString(objectPath).c_str());
    //     ++(ic.count);
    //   }
    // }
    // when we get to a key that matches a path up until the end,
    // we want to stream a report until the path no longer matches.
    // if currentReport is not null, check if it's still valid.
    // if so, write that key and let it ride.
    // otherwise, set it to null
    if (currentReport != NULL)
    {
      if (almostThere(currentReport->path))
      {
        reportWriter->Key(lastKey);
      }
      else
      {
        currentReport = NULL;
      }
    }
    // if currentReport is null, check if it matches any paths.
    // if so, set currentReport to that report, and start up that report at the current path.
    if (currentReport == NULL)
    {
      for (auto &ir : pathsForReporting)
      {
        if (schemaName == ir.schemaName && ir.path.back() != "[]" && almostThere(ir.path))
        {
          reportWriter->Key(objectPathToString(objectPathWithArrayIndices, lastKey));
          currentReport = (&ir);
          break;
        }
      }
    }
    return true;
  }

  bool String(const Ch *str, SizeType len, bool copy)
  {
    if (objectPath.size() > 0 && objectPath.back() == "[]" && lastKey == "")
    {
      objectPathWithArrayIndices.back().second++;
    }
    lastKey = "";
    if (currentReport != NULL)
    {
      reportWriter->String(str);
      // if our path is to this exactly, we should stop reporting
      if (!almostThere(currentReport->path))
      {
        currentReport = NULL;
      }
    }

    return BaseReaderHandler::String(str, len, copy);
  }

  bool StartObject()
  {
    if (lastKey.size() > 0)
    {
      objectPath.push_back(lastKey);
      objectPathWithArrayIndices.push_back(make_pair(lastKey, -1));
    }
    else
    {
      // lastKey is empty, which means that this object is an element of an array.
      // so, check paths that end with "[]", because they want to count up array elements.
      for (auto &countPath : pathsForCounting)
      {
        if (schemaName == countPath.schemaName && countPath.path.back() == "[]" && countPath.path == objectPath)
        {
          printf("found an item in an array! %s\n", objectPathToString(countPath.path).c_str());
          ++(countPath.count);
        }
      }
    }
    if (currentReport != NULL)
    {
      reportWriter->StartObject();
    }
    return BaseReaderHandler::StartObject();
  }

  bool EndObject(SizeType len)
  {
    // here is the place where we can count up how many of an object appears
    // or maybe we do that at start object? or at key?
    if (objectPath.size() > 0 && objectPath.back() != "[]")
    {
      objectPath.pop_back();
      objectPathWithArrayIndices.pop_back();
    }
    else if (objectPath.size() > 0 && objectPath.back() == "[]")
    {
      objectPathWithArrayIndices.back().second++;
    }
    lastKey = "";
    if (currentReport != NULL)
    {
      reportWriter->EndObject();
      if (!almostThere(currentReport->path))
      {
        currentReport = NULL;
      }
    }
    return BaseReaderHandler::EndObject(len);
  }

  bool StartArray()
  {
    objectPath.push_back(lastKey);
    objectPath.push_back("[]");
    objectPathWithArrayIndices.push_back(make_pair(lastKey, -1));
    objectPathWithArrayIndices.push_back(make_pair("[]", 0));
    lastKey = "";
    if (currentReport != NULL)
    {
      reportWriter->StartArray();
    }
    return BaseReaderHandler::StartArray();
  }

  bool EndArray(SizeType len)
  {
    objectPath.pop_back();
    objectPath.pop_back();
    objectPathWithArrayIndices.pop_back();
    objectPathWithArrayIndices.pop_back();
    // we may have fallen off the current report path
    lastKey = "";
    if (currentReport != NULL)
    {
      reportWriter->EndArray();
      if (!almostThere(currentReport->path))
      {
        currentReport = NULL;
      }
    }
    return BaseReaderHandler::EndArray(len);
  }

  bool almostThere(list<string> &targetPath)
  {
    // true if objectPath + [lastKey] matches targetPath until the end of targetPath is reached
    int objectLength = objectPath.size();
    int targetLength = targetPath.size();
    if (objectLength + 1 >= targetLength)
    {
      list<string>::iterator targIt = targetPath.begin();
      for (list<string>::iterator objIt = objectPath.begin(); objIt != objectPath.end(); ++objIt)
      {
        if (targIt == targetPath.end())
        {
          return true;
        }
        else if (*targIt != *objIt)
        {
          return false;
        }
        ++targIt;
      }
      return targIt == targetPath.end() || lastKey == *targIt;
    }
    else
    {
      return false;
    }
  }
};

// list<string> MessageHandler::providerReferencePath = {"provider_references", "[]", "location"};
list<string> MessageHandler::tocInNetworkPath = {"reporting_structure", "[]", "in_network_files"};
list<string> MessageHandler::tocAllowedAmountPath = {"reporting_structure", "[]", "allowed_amount_file"};
// list<string> MessageHandler::negotiatedPricePath = {"in_network", "[]", "negotiated_rates", "[]", "negotiated_prices", "[]"};
list<string> MessageHandler::additionalInfoPath = {"in_network", "[]", "negotiated_rates", "[]", "negotiated_prices", "[]", "additional_information"};
list<string> MessageHandler::inNetworkProviderGroupsPath = {"in_network", "[]", "negotiated_rates", "[]", "provider_groups"};

int main(int argc, char *argv[])
{
  string schemaPath;
  string dataPath;
  string outputPath;
  int bufferSize = 4069;
  string schemaName;
  bool failFast;

  try
  {
    TCLAP::CmdLine cmd("validator for machine-readable files", ' ', "0.1");
    TCLAP::UnlabeledValueArg<string> schemaArg("schema-path", "path to schema file", true, "", "path");
    TCLAP::UnlabeledValueArg<string> dataArg("data-path", "path to data file", true, "", "path");
    TCLAP::UnlabeledValueArg<string> outputArg("output-path", "path to output directory", false, "/output", "path");
    TCLAP::ValueArg<int> bufferArg("b", "buffer-size", "buffer size in bytes", false, 4069, "integer");
    TCLAP::ValueArg<string> schemaNameArg("s", "schema-name", "schema name", false, "", "string");
    TCLAP::SwitchArg failFastArg("f", "fail-fast", "if set, stop validating after the first error");
    cmd.add(schemaArg);
    cmd.add(dataArg);
    cmd.add(outputArg);
    cmd.add(bufferArg);
    cmd.add(schemaNameArg);
    cmd.add(failFastArg);
    cmd.parse(argc, argv);
    schemaPath = schemaArg.getValue();
    dataPath = dataArg.getValue();
    outputPath = outputArg.getValue();
    bufferSize = bufferArg.getValue();
    schemaName = schemaNameArg.getValue();
    failFast = failFastArg.getValue();
  }
  catch (TCLAP::ArgException &e)
  {
    fprintf(stderr, "%s", e.error().c_str());
    return EXIT_FAILURE;
  }

  // if an output file is specified, try to open it for writing
  FILE *outFile;
  FILE *reportFile;
  FILE *errFile;
  FILE *errJsonFile;
  bool fileOutput = false;
  bool reportOutput = false;
  if (outputPath.length() > 0)
  {
    if (!filesystem::exists(outputPath))
    {
      filesystem::create_directories(outputPath);
    }
    else if (!filesystem::is_directory(outputPath))
    {
      printf("Could not use directory '%s' for output: path already exists and is not a directory\n", outputPath.c_str());
      return -1;
    }
    outFile = fopen((filesystem::path(outputPath) / "output.txt").c_str(), "w");
    if (!outFile)
    {
      printf("Could not open output file in '%s' for output\n", outputPath.c_str());
      return -1;
    }
    reportFile = fopen((filesystem::path(outputPath) / "reports.json").c_str(), "w");
    if (!reportFile)
    {
      printf("Could not create report output file. Reported information will not be saved to file.");
      reportFile = stdout;
    }
    else
    {
      reportOutput = true;
    }
    errJsonFile = fopen((filesystem::path(outputPath) / "errors.json").c_str(), "w");
    if (!errJsonFile)
    {
      printf("Could not create error json file. JSON errors will be written to main output file.");
      errJsonFile = outFile;
    }
    errFile = outFile;
    fileOutput = true;
  }
  else
  {
    outFile = stdout;
    reportFile = stdout;
    errFile = stderr;
    errJsonFile = stderr;
  }

  // Read a JSON schema from file into Document
  Document d;
  char buffer[bufferSize];

  {
    FILE *fp = fopen(schemaPath.c_str(), "r");
    if (!fp)
    {
      fprintf(outFile, "Schema file '%s' not found\n", schemaPath.c_str());
      if (fileOutput)
      {
        fclose(outFile);
      }
      return -1;
    }
    FileReadStream fs(fp, buffer, sizeof(buffer));
    d.ParseStream(fs);
    if (d.HasParseError())
    {
      fprintf(errFile, "Schema file '%s' is not a valid JSON\n", schemaPath.c_str());
      fprintf(errFile, "Error(offset %u): %s\n",
              static_cast<unsigned>(d.GetErrorOffset()),
              GetParseError_En(d.GetParseError()));
      fclose(fp);
      if (fileOutput)
      {
        fclose(outFile);
      }
      return EXIT_FAILURE;
    }
    fclose(fp);
  }

  // Then convert the Document into SchemaDocument
  SchemaDocument sd(d);

  // Use reader to parse the JSON in stdin, and forward SAX events to validator
  char lb[1024];
  FileWriteStream reportStream(reportFile, lb, 1024);
  PrettyWriter<FileWriteStream> reportWriter(reportStream);
  reportWriter.SetIndent(' ', 2);
  MessageHandler handler(schemaName, reportWriter);
  GenericSchemaValidator<SchemaDocument, MessageHandler> validator(sd, handler);
  // set validator flags
  if (!failFast)
  {
    validator.SetValidateFlags(kValidateContinueOnErrorFlag);
  }

  Reader reader;
  FILE *fp2 = fopen(dataPath.c_str(), "r");
  if (!fp2)
  {
    fprintf(outFile, "JSON file '%s' not found\n", dataPath.c_str());
    if (fileOutput)
    {
      fclose(outFile);
    }
    return -1;
  }
  FileReadStream is(fp2, buffer, sizeof(buffer));
  if (!reader.Parse<kParseNumbersAsStringsFlag, FileReadStream, GenericSchemaValidator<SchemaDocument, MessageHandler>>(is, validator) && reader.GetParseErrorCode() != kParseErrorTermination)
  {
    // Schema validator error would cause kParseErrorTermination, which will handle it in next step.
    fprintf(errFile, "Input is not a valid JSON\n");
    fprintf(errFile, "Error(offset %u): %s\n",
            static_cast<unsigned>(reader.GetErrorOffset()),
            GetParseError_En(reader.GetParseErrorCode()));
    handler.CleanupWriter();
    return EXIT_FAILURE;
  }
  handler.CleanupWriter();
  if (reportOutput)
  {
    fclose(reportFile);
  }
  // Check the validation result
  if (validator.IsValid())
  {
    fprintf(outFile, "Input JSON is valid.\n");

    if (fileOutput)
    {
      fclose(outFile);
    }
    return EXIT_SUCCESS;
  }
  else
  {
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
    fprintf(errJsonFile, sb.GetString());
    CreateErrorMessages(validator.GetError(), outFile);
    if (fileOutput)
    {
      fclose(outFile);
    }
    return EXIT_FAILURE;
  }
}
