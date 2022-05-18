import classNames from "classnames";
import { padStart } from "lodash";
import dynamic from "next/dynamic";
import { CommandResponse } from "protocol/socket";
import { useState } from "react";
import { useSelector } from "react-redux";
import { getTheme } from "ui/reducers/app";
import {
  getFullRequestDetails,
  getProtocolRequests,
  Recorded,
  RequestSummary,
} from "ui/reducers/protocolMessages";

const ReactJson = dynamic(() => import("react-json-view"), {
  ssr: false,
});

const msAsMinutes = (ms: number) => {
  const seconds = Math.round(ms / 1000.0);
  return `${Math.floor(seconds / 60)}:${padStart(String(seconds % 60), 2, "0")}`;
};

const fullMethod = (request: RequestSummary): string => {
  return `${request.class}.${request.method}`;
};

type RequestSummaryChunk = {
  ids: number[];
  count: number;
  method: string;
  pending: boolean;
  errored: boolean;
  startedAt: number;
};

type ChunkReducer = {
  chunks: RequestSummaryChunk[];
  current: RequestSummaryChunk;
};

const chunkedRequests = (requests: RequestSummary[]): RequestSummaryChunk[] => {
  return requests.reduce(
    (acc: ChunkReducer, request: RequestSummary) => {
      const { current } = acc;
      if (
        current.method === fullMethod(request) &&
        current.pending === request.pending &&
        current.errored === request.errored
      ) {
        current.count++;
        current.ids.push(request.id);
      } else {
        acc.chunks.push(current);
        acc.current = {
          count: 1,
          ids: [request.id],
          errored: request.errored,
          method: fullMethod(request),
          pending: request.pending,
          startedAt: request.recordedAt,
        };
      }
      return acc;
    },
    {
      chunks: [],
      current: {
        count: 0,
        ids: [],
        method: "",
        pending: false,
        errored: false,
        startedAt: 0,
      },
    }
  ).chunks;
};

const JSONViewer = ({ src }: { src: object }) => {
  const theme = useSelector(getTheme);

  return (
    <ReactJson
      style={{ backgroundColor: "none" }}
      theme={theme == "light" ? "rjv-default" : "tube"}
      src={src}
      shouldCollapse={false}
      displayDataTypes={false}
      displayObjectSize={false}
    />
  );
};

const ProtocolRequestDetail = ({
  request,
  response,
  error,
}: {
  request: RequestSummary;
  response: (CommandResponse & Recorded) | undefined;
  error: (CommandResponse & Recorded) | undefined;
}) => {
  return (
    <div>
      Request
      <JSONViewer src={request} />
      {response && (
        <>
          Response
          <JSONViewer src={response} />
        </>
      )}
      {error && (
        <>
          Error
          <JSONViewer src={error} />
        </>
      )}
    </div>
  );
};

const ProtocolViewer = () => {
  const requests = useSelector(getProtocolRequests);
  const chunks = chunkedRequests(requests);
  const [selectedRequests, setSelectedRequests] = useState<number[]>([]);
  const selectedRequestDetails = useSelector(getFullRequestDetails(selectedRequests));

  return (
    <div className="max-h-full overflow-y-scroll p-4">
      {selectedRequestDetails.map(({ request, response, error }) => {
        return (
          <ProtocolRequestDetail
            key={request!.id}
            request={request!}
            response={response}
            error={error}
          />
        );
      })}
      <h3 className="text-lg">Protocol Info</h3>
      {chunks.map(chunk => {
        return (
          <div
            key={`${chunk.method}:${chunk.startedAt}`}
            className={classNames("flex justify-between p-1", {
              "text-lightGrey": chunk.pending,
              "text-errorColor": chunk.errored,
            })}
            onClick={() => {
              setSelectedRequests(chunk.ids);
            }}
          >
            <span>
              {chunk.method}
              {chunk.count > 1 ? `(${chunk.count})` : null}
            </span>
            <span>{msAsMinutes(chunk.startedAt)}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ProtocolViewer;