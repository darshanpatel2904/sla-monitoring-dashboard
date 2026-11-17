"use client";

import React, { useState } from "react";
import { Modal, Upload, Button, Alert, Spin, App } from "antd";
import {
  InboxOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import { uploadCustomCsvAction } from "../actions";
import { UploadActionResult } from "../schemas/upload.schema";
import { validateCsvMetadata, validateCsvBuffer } from "../validator";
import { MAX_UPLOAD_FILE_SIZE_MB } from "@/lib/constants";

const { Dragger } = Upload;

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadModal({ open, onClose, onSuccess }: UploadModalProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadActionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * Validate file content locally before sending request
   */
  const validateFileLocally = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        validateCsvMetadata(file.name, file.size);
      } catch (err) {
        return reject(err);
      }

      const reader = new FileReader();
      const slice = file.slice(0, 4096);

      reader.onload = () => {
        try {
          const buffer = new Uint8Array(reader.result as ArrayBuffer);
          validateCsvBuffer(buffer);
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(
          new Error(
            "Unable to read file headers. Please ensure it is a valid CSV file.",
          ),
        );
      };

      reader.readAsArrayBuffer(slice);
    });
  };

  const handleCustomUpload = async (file: File) => {
    if (loading) return false;
    setErrorMsg(null);
    setResult(null);

    // Client-side pre-validation
    try {
      await validateFileLocally(file);
    } catch (valErr: unknown) {
      const msg =
        valErr instanceof Error
          ? valErr.message
          : "Invalid file selected. Please select a valid CSV file.";
      setErrorMsg(msg);
      message.error(msg);
      return false;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadCustomCsvAction(formData);
      setResult(res);
      message.success(`Successfully processed ${res.filename}!`);
      onSuccess();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Upload failed. Please check the file and try again.";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }

    return false; // Prevent default upload behavior
  };

  const handleClose = () => {
    if (!loading) {
      setResult(null);
      setErrorMsg(null);
      onClose();
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 font-mono text-sm">
          <CloudUploadOutlined className="text-[#143F3A] text-lg" />
          <span>UPLOAD TELEMETRY DATA</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={[
        <Button
          key="close"
          onClick={handleClose}
          disabled={loading}
          className="font-mono text-xs"
        >
          Close
        </Button>,
      ]}
      width={600}
      className="font-mono"
    >
      <div className="space-y-4 py-2 flex flex-col gap-7">
        <p className="text-xs text-zinc-600 font-mono">
          Upload your service telemetry CSV file. The system will automatically
          validate records, deduplicate checks, and calculate your SLA uptime
          metrics.
        </p>

        {/* Drag and Drop File Upload Area */}
        <Dragger
          name="file"
          accept=".csv,text/csv"
          multiple={false}
          maxCount={1}
          showUploadList={false}
          disabled={loading}
          beforeUpload={handleCustomUpload}
          className="bg-white hover:border-[#143F3A] transition-colors"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: "#143F3A" }} />
          </p>
          <p className="ant-upload-text font-mono text-xs font-semibold text-zinc-800">
            Click or drag CSV file to this area to upload
          </p>
          <p className="ant-upload-hint font-mono text-[11px] text-zinc-500">
            Accepts telemetry CSV files up to {MAX_UPLOAD_FILE_SIZE_MB}MB.
            Requires{" "}
            <span className="font-semibold text-zinc-700">timestamp</span>,{" "}
            <span className="font-semibold text-zinc-700">service_id</span>, and{" "}
            <span className="font-semibold text-zinc-700">status_code</span>{" "}
            columns.
          </p>
        </Dragger>

        {/* Loading Indicator */}
        {loading && (
          <div className="p-4 text-center space-y-2 bg-emerald-50/60 border border-emerald-200 rounded-lg">
            <Spin />
            <div className="text-xs font-mono text-emerald-900 font-medium">
              Validating and processing telemetry data...
            </div>
            <div className="text-[11px] font-mono text-emerald-700">
              Please wait while health checks are verified and saved.
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <Alert
            title="Validation or Processing Error"
            description={errorMsg}
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
            className="text-xs font-mono"
          />
        )}

        {/* Success Alert with User-Friendly Summary */}
        {result && (
          <Alert
            title={
              <div className="flex items-center gap-1.5 font-bold">
                <FileDoneOutlined className="text-emerald-700" />
                <span>Telemetry Ingested Successfully</span>
              </div>
            }
            description={
              <div className="space-y-2 font-mono text-xs text-zinc-700 mt-2">
                <div className="text-zinc-600">
                  File:{" "}
                  <strong className="text-zinc-900">{result.filename}</strong>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200 text-[11px]">
                  <div className="p-2 bg-white/70 rounded border border-emerald-100">
                    <span className="text-zinc-500 block">Total Records:</span>
                    <strong className="text-zinc-900 text-sm">
                      {result.totalRows.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2 bg-white/70 rounded border border-emerald-100">
                    <span className="text-zinc-500 block">
                      Valid Clean Checks:
                    </span>
                    <strong className="text-emerald-800 text-sm">
                      {result.validRows.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2 bg-white/70 rounded border border-emerald-100">
                    <span className="text-zinc-500 block">
                      New Checks Saved:
                    </span>
                    <strong className="text-zinc-900 text-sm">
                      {result.insertedRows.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2 bg-white/70 rounded border border-emerald-100">
                    <span className="text-zinc-500 block">
                      Duplicates Skipped:
                    </span>
                    <strong className="text-zinc-900 text-sm">
                      {result.duplicateRows.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="pt-1 text-[11px] text-zinc-500">
                  Completed in {(result.durationMs / 1000).toFixed(2)} seconds.
                </div>
              </div>
            }
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            className="text-xs font-mono border-emerald-300 bg-emerald-50/50"
          />
        )}
      </div>
    </Modal>
  );
}
