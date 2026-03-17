import { useEffect, useRef, useState, type Dispatch, type FormEvent, type RefObject, type SetStateAction } from 'react';
import type { AirportCode, AirportStatus } from '../../../shared/airport-status';
import {
  REPORT_CROWD_LEVELS,
  REPORT_QUEUE_LENGTHS,
  REPORT_TTL_HOURS,
  type AirportReport,
  type ReportCrowdLevel,
  type ReportQueueLength,
} from '../../../shared/report';
import type { FlightBoardEntry, FlightBoardsApiResponse } from '../../../shared/flight-board';
import {
  checkpointTag,
  formatBoardDirectionLabel,
  formatBoardRouteLabel,
  formatBoardStatusMeta,
  formatBoardTime,
  formatBoardTimeMeta,
  formatCoverageTierLabel,
  formatDenseBoardRemark,
  formatDenseBoardRoute,
  formatDenseBoardTime,
  formatDistanceNm,
  formatRelativeTime,
  formatReportLifetime,
  formatRiskDisplay,
  formatTrafficKindLabel,
  formatWaitSourceLabel,
  formatOpsSourceLabel,
  MAX_TRAFFIC_EXTRAPOLATION_SECONDS,
  type AirportCoverageTier,
  type BoardSectionKey,
  type ConcourseBoardPanelModel,
  type FlightFormState,
  type FlightRiskData,
  type FlightRiskMode,
  type FocusedTrafficNode,
  type FocusedTrafficSummary,
  type ReportFormState,
  type ReportLoadMode,
  type ReportSubmitMode,
  type SelectedBoardFocus,
  type StatusMetric,
  type TrackerLink,
} from '../lib/airport-now';
import { resolveApiAssetUrl } from '../lib/airport-api';
import { formatReportPhotoBytes, optimizeReportPhotoForUpload } from '../lib/report-photos';

type HeroHeaderProps = {
  airports: AirportStatus[];
  selectedCode: AirportCode;
  onSelectAirport: (code: AirportCode) => void;
  mode: 'loading' | 'live' | 'fallback';
  error: string | null;
  selectedStatusMetrics: StatusMetric[];
  airportSwitcherCanScrollLeft: boolean;
  airportSwitcherCanScrollRight: boolean;
  onScrollAirportSwitcher: (direction: 'left' | 'right') => void;
  airportSwitcherRailRef: RefObject<HTMLDivElement | null>;
};

type SelectedAirportStripProps = {
  selectedAirport: AirportStatus;
  selectedCoverageTier: AirportCoverageTier;
};

type CommunityPanelProps = {
  selectedAirport: AirportStatus;
  hasStructuredCheckpointOptions: boolean;
  reportCheckpointOptions: string[];
  reportForm: ReportFormState;
  setReportForm: Dispatch<SetStateAction<ReportFormState>>;
  reportSubmitMode: ReportSubmitMode;
  reportSubmitMessage: string | null;
  reportsMode: ReportLoadMode;
  reportsError: string | null;
  reports: AirportReport[];
  reportCameraInputRef: RefObject<HTMLInputElement | null>;
  reportUploadInputRef: RefObject<HTMLInputElement | null>;
  setSelectedReportPhoto: (photo: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

type ConcourseBoardPanelProps = {
  selectedAirport: AirportStatus;
  boardAirportClock: string;
  boardAirportTimeZoneShort: string;
  concourseBoardCounts: { departures: number; arrivals: number };
  flightBoards: FlightBoardsApiResponse | null;
  flightBoardsMode: 'idle' | 'loading' | 'ready' | 'error';
  flightBoardsError: string | null;
  concourseBoardPanels: ConcourseBoardPanelModel[];
  selectedBoardFocus: SelectedBoardFocus | null;
  onOpenBoardDetail: (sectionKey: BoardSectionKey, entry: FlightBoardEntry) => void;
};

type FlightBoardDetailPanelProps = {
  selectedBoardEntry: FlightBoardEntry | null;
  selectedBoardFocus: SelectedBoardFocus | null;
  flightBoards: FlightBoardsApiResponse | null;
  boardAirportTimeZoneShort: string;
  onDismiss: () => void;
};

type CheckpointDetailPanelProps = {
  selectedAirport: AirportStatus;
  selectedCoverageTier: AirportCoverageTier;
};

type FlightRiskPanelProps = {
  airports: AirportStatus[];
  flightForm: FlightFormState;
  setFlightForm: Dispatch<SetStateAction<FlightFormState>>;
  flightOriginAirport: AirportStatus;
  flightOriginTimeZoneShort: string;
  flightRiskMode: FlightRiskMode;
  flightRiskError: string | null;
  flightRisk: FlightRiskData | null;
  routeLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAirport: (code: AirportCode) => void;
};

type AirspacePanelProps = {
  selectedAirport: AirportStatus;
  selectedCoverageTier: AirportCoverageTier;
  focusedTraffic: FocusedTrafficSummary;
  activeTrafficAircraft: FocusedTrafficNode | null;
  activeTrafficAircraftId: string | null;
  activeTrafficBoardMatch: { entry: FlightBoardEntry; sectionKey: BoardSectionKey } | null;
  selectedAirportAirborneSummary: string;
  selectedAirportTrafficSummary: string;
  trackerLinks: TrackerLink[];
  airportTrafficError: string | null;
  onMapBackgroundClick: () => void;
  onAircraftEnter: (aircraftId: string) => void;
  onAircraftLeave: (aircraftId: string) => void;
  onAircraftClick: (aircraftId: string) => void;
};

type CommunityPhotoPreviewProps = {
  imageUrl: string | null;
  alt: string;
  className: string;
  fallbackClassName: string;
};

const GITHUB_REPO_URL = 'https://github.com/mylee04/airport-now';

function CommunityPhotoPreview({ imageUrl, alt, className, fallbackClassName }: CommunityPhotoPreviewProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [imageUrl]);

  if (!imageUrl || loadFailed) {
    return <div className={fallbackClassName}>Photo unavailable</div>;
  }

  return <img className={className} src={imageUrl} alt={alt} onError={() => setLoadFailed(true)} />;
}

export function HeroHeader({
  airports,
  selectedCode,
  onSelectAirport,
  mode,
  error,
  selectedStatusMetrics,
  airportSwitcherCanScrollLeft,
  airportSwitcherCanScrollRight,
  onScrollAirportSwitcher,
  airportSwitcherRailRef,
}: HeroHeaderProps) {
  return (
    <header className="hero">
      <div className="hero-copy">
        <div className="hero-top">
        <div className="hero-lockup">
          <p className="eyebrow">Live airport intelligence for the one airport you are actually using</p>
          <h1 className="hero-brand">Airport Now</h1>
        </div>

        <div className="hero-intro">
          <div className="hero-intro-top">
            <a
              className="hero-github-link"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
            >
              <svg className="hero-github-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38
                  0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52
                  -.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78
                  -.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21
                  2.2.82A7.5 7.5 0 0 1 8 3.5a7.5 7.5 0 0 1 2.01.27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16
                  1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54
                  1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                />
              </svg>
              <span>GitHub</span>
            </a>
          </div>

          <p className="hero-headline">Read the terminal before you leave for the airport.</p>

          <div className="hero-actions">
              <a className="primary-button" href="#airport-picker">
                Choose Airport
              </a>
              <a className="secondary-button" href="#checkpoint-detail">
                Read Checkpoints
              </a>
            </div>
          </div>
        </div>

        <div className="hero-switcher" id="airport-picker">
          <div className="airport-switcher-head">
            <p className="panel-label">Select departure airport</p>
            <div className="airport-switcher-controls" aria-label="Airport tab scroll controls">
              <button
                type="button"
                className="airport-switcher-arrow"
                onClick={() => onScrollAirportSwitcher('left')}
                disabled={!airportSwitcherCanScrollLeft}
                aria-label="Scroll airport tabs left"
              >
                {'<'}
              </button>
              <button
                type="button"
                className="airport-switcher-arrow"
                onClick={() => onScrollAirportSwitcher('right')}
                disabled={!airportSwitcherCanScrollRight}
                aria-label="Scroll airport tabs right"
              >
                {'>'}
              </button>
            </div>
          </div>
          <div
            ref={airportSwitcherRailRef}
            className="airport-switcher-rail"
            aria-label="Departure airport quick switcher"
          >
            {airports.map((airport) => {
              const isSelected = airport.code === selectedCode;

              return (
                <button
                  key={airport.code}
                  type="button"
                  data-airport-code={airport.code}
                  className={`airport-switcher-tab ${isSelected ? 'airport-switcher-tab-selected' : ''}`}
                  onClick={() => onSelectAirport(airport.code)}
                  aria-pressed={isSelected}
                >
                  <span className="airport-switcher-code">{airport.code}</span>
                  <span className="airport-switcher-city">{airport.city}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="status-strip">
          <div className="status-metric status-metric-mode">
            <span className="status-metric-label">Data mode</span>
            <span className={`status-badge status-badge-${mode}`}>
              {mode === 'live' ? 'Live API' : mode === 'fallback' ? 'Fallback snapshot' : 'Loading'}
            </span>
          </div>
          {selectedStatusMetrics.map((metric) => (
            <div key={metric.label} className="status-metric">
              <span className="status-metric-label">{metric.label}</span>
              <strong className="status-metric-value">{metric.value}</strong>
            </div>
          ))}
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
      </div>
    </header>
  );
}

export function SelectedAirportStrip({ selectedAirport, selectedCoverageTier }: SelectedAirportStripProps) {
  const showCrowdLevel = selectedAirport.crowdLevel !== 'Unknown';
  const showConfidence =
    selectedAirport.waitTimeSource !== 'none' || selectedAirport.riskSource !== 'none' || selectedAirport.reports > 0;
  const visibleSignals = selectedAirport.signals.filter((signal) => signal !== 'Seasonal travel');

  return (
    <section className="selected-airport-strip" aria-label={`${selectedAirport.code} summary`}>
      <div className="selected-airport-strip-head">
        <div>
          <div className="selected-airport-inline">
            <h2>{selectedAirport.code}</h2>
            <p>{selectedAirport.name}</p>
            {showCrowdLevel ? (
              <span className={`pill pill-${selectedAirport.crowdLevel.toLowerCase()}`}>{selectedAirport.crowdLevel}</span>
            ) : null}
          </div>
        </div>

        <div className="selected-airport-meta">
          {showConfidence ? <span>Confidence {selectedAirport.confidence}</span> : null}
          <span>Updated {formatRelativeTime(selectedAirport.updatedAt)}</span>
          {selectedCoverageTier !== 'limited' ? <span>{formatCoverageTierLabel(selectedCoverageTier)}</span> : null}
        </div>
      </div>

      <div className="selected-airport-metrics">
        <div className="selected-airport-metric">
          <span>Wait</span>
          <strong>{selectedAirport.waitDisplay}</strong>
        </div>
        <div className="selected-airport-metric">
          <span>Delay Risk</span>
          <strong>{formatRiskDisplay(selectedAirport.delayRisk)}</strong>
        </div>
        <div className="selected-airport-metric">
          <span>Cancel Risk</span>
          <strong>{formatRiskDisplay(selectedAirport.cancelRisk)}</strong>
        </div>
      </div>

      <p className="selected-airport-note">{selectedAirport.note}</p>

      {visibleSignals.length > 0 ? (
        <div className="source-list selected-airport-signals">
          {visibleSignals.map((signal) => (
            <span key={signal} className="source-chip source-chip-strong">
              {signal}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function CommunityPanel({
  selectedAirport,
  hasStructuredCheckpointOptions,
  reportCheckpointOptions,
  reportForm,
  setReportForm,
  reportSubmitMode,
  reportSubmitMessage,
  reportsMode,
  reportsError,
  reports,
  reportCameraInputRef,
  reportUploadInputRef,
  setSelectedReportPhoto,
  onSubmit,
}: CommunityPanelProps) {
  const [communityView, setCommunityView] = useState<'auto' | 'feed' | 'photos'>('auto');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraState, setCameraState] = useState<'idle' | 'opening' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [reportPhotoPreviewUrl, setReportPhotoPreviewUrl] = useState<string | null>(null);
  const [photoPrepareMode, setPhotoPrepareMode] = useState<'idle' | 'processing' | 'error'>('idle');
  const [photoPrepareMessage, setPhotoPrepareMessage] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const photoReports = reports.filter((report) => Boolean(report.photoUrl));
  const resolvedCommunityView = communityView === 'auto' ? (photoReports.length > 0 ? 'photos' : 'feed') : communityView;

  const stopCameraStream = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
    setCameraState('idle');
    setCameraError(null);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      reportCameraInputRef.current?.click();
      return;
    }

    stopCameraStream();
    setCameraOpen(true);
    setCameraState('opening');
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraState('ready');

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraState('error');
      setCameraError('Camera access is blocked right now. Use Upload photo instead.');
      stopCameraStream();
    }
  };

  const clearPreparedPhoto = () => {
    setSelectedReportPhoto(null);
    setPhotoPrepareMode('idle');
    setPhotoPrepareMessage(null);
  };

  const prepareSelectedPhoto = async (file: File | null) => {
    if (!file) {
      clearPreparedPhoto();
      return;
    }

    setPhotoPrepareMode('processing');
    setPhotoPrepareMessage('Optimizing photo for upload...');

    try {
      const preparedPhoto = await optimizeReportPhotoForUpload(file);
      setSelectedReportPhoto(preparedPhoto.file);
      setPhotoPrepareMode('idle');
      setPhotoPrepareMessage(
        preparedPhoto.optimized
          ? `Photo optimized to ${formatReportPhotoBytes(preparedPhoto.file.size)} for upload.`
          : `Photo ready: ${formatReportPhotoBytes(preparedPhoto.file.size)}`,
      );
    } catch (error) {
      setSelectedReportPhoto(null);
      setPhotoPrepareMode('error');
      setPhotoPrepareMessage(
        error instanceof Error ? error.message : 'The photo could not be prepared for upload.',
      );
    }
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('The camera is still warming up. Try capture again in a second.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      setCameraError('This browser could not capture the photo.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('The photo could not be saved. Try again.');
          return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        void prepareSelectedPhoto(
          new File([blob], `${selectedAirport.code.toLowerCase()}-checkpoint-${timestamp}.jpg`, {
            type: 'image/jpeg',
          }),
        );
        closeCamera();
      },
      'image/jpeg',
      0.92,
    );
  };

  useEffect(() => {
    setCommunityView('auto');
    setPhotoPrepareMode('idle');
    setPhotoPrepareMessage(null);
  }, [selectedAirport.code]);

  useEffect(() => {
    if (!reportForm.photo) {
      setReportPhotoPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(reportForm.photo);
    setReportPhotoPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [reportForm.photo]);

  useEffect(() => {
    if (!reportForm.photo && photoPrepareMode !== 'error') {
      setPhotoPrepareMessage(null);
    }
  }, [photoPrepareMode, reportForm.photo]);

  useEffect(() => () => stopCameraStream(), []);

  return (
    <section className="info-panel community-priority-panel" id="community-reports">
      <div className="community-priority-head">
        <div>
          <p className="section-kicker">Community layer</p>
          <h2>Post what the line looks like right now</h2>
        </div>
        <div className="community-priority-meta">
          <span>{selectedAirport.code}</span>
          <span>{reports.length} reports</span>
          <span>{photoReports.length} photos</span>
        </div>
      </div>

      <p className="detail-insight">
        Reports and photos are stored on the Airport Now API for this airport feed, shown to other travelers here, and
        auto-delete after {REPORT_TTL_HOURS} hours.
      </p>

      {cameraOpen ? (
        <div className="camera-modal-backdrop" role="presentation" onClick={closeCamera}>
          <div
            className="camera-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${selectedAirport.code}-camera-heading`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="camera-modal-head">
              <div>
                <p className="panel-label">Live camera</p>
                <h3 id={`${selectedAirport.code}-camera-heading`}>Capture the checkpoint line</h3>
              </div>
              <button type="button" className="camera-close-button" onClick={closeCamera} aria-label="Close camera">
                Close
              </button>
            </div>

            <div className="camera-preview-shell">
              {cameraState === 'ready' ? (
                <video ref={cameraVideoRef} className="camera-preview" autoPlay muted playsInline />
              ) : (
                <div className="camera-preview-placeholder">
                  <strong>{cameraState === 'opening' ? 'Opening camera...' : 'Camera unavailable'}</strong>
                  <p>
                    {cameraError ??
                      'Allow camera access in the browser prompt, then point at the checkpoint line and capture one frame.'}
                  </p>
                </div>
              )}
            </div>

            <div className="camera-modal-actions">
              <button
                type="button"
                className="secondary-button report-photo-button"
                onClick={() => {
                  closeCamera();
                  reportUploadInputRef.current?.click();
                }}
              >
                Use upload instead
              </button>
              <button
                type="button"
                className="primary-button report-photo-button"
                onClick={capturePhoto}
                disabled={cameraState !== 'ready'}
              >
                Capture photo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <form className="report-form" onSubmit={onSubmit}>
        <div className="report-form-row">
          <label className="flight-field">
            <span>{hasStructuredCheckpointOptions ? 'Checkpoint' : 'Where are you standing?'}</span>
            {hasStructuredCheckpointOptions ? (
              <select
                className="field-control"
                value={reportForm.checkpoint}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, checkpoint: event.target.value }))
                }
              >
                {reportCheckpointOptions.map((checkpointName) => (
                  <option key={checkpointName} value={checkpointName}>
                    {checkpointName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="field-control"
                type="text"
                value={reportForm.checkpoint}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, checkpoint: event.target.value }))
                }
                placeholder={`${selectedAirport.code} main checkpoint`}
              />
            )}
            {!hasStructuredCheckpointOptions ? (
              <small className="field-hint">
                Structured checkpoint names are not available here yet, so enter the checkpoint or terminal area yourself.
              </small>
            ) : null}
          </label>

          <label className="flight-field">
            <span>Queue</span>
            <select
              className="field-control"
              value={reportForm.queueLength}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  queueLength: event.target.value as ReportQueueLength,
                }))
              }
            >
              {REPORT_QUEUE_LENGTHS.map((queueLength) => (
                <option key={queueLength} value={queueLength}>
                  {queueLength}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="report-form-row">
          <label className="flight-field">
            <span>Crowd feel</span>
            <select
              className="field-control"
              value={reportForm.crowdLevel}
              onChange={(event) =>
                setReportForm((current) => ({
                  ...current,
                  crowdLevel: event.target.value as ReportCrowdLevel,
                }))
              }
            >
              {REPORT_CROWD_LEVELS.map((crowdLevel) => (
                <option key={crowdLevel} value={crowdLevel}>
                  {crowdLevel}
                </option>
              ))}
            </select>
          </label>

          <div className="flight-field">
            <span>Optional photo</span>
            <input
              ref={reportCameraInputRef}
              className="report-file-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                void prepareSelectedPhoto(event.target.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
            <input
              ref={reportUploadInputRef}
              className="report-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                void prepareSelectedPhoto(event.target.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
            <div className="report-photo-actions">
              <button
                type="button"
                className="secondary-button report-photo-button"
                onClick={() => {
                  void openCamera();
                }}
              >
                Take photo
              </button>
              <button
                type="button"
                className="secondary-button report-photo-button"
                onClick={() => reportUploadInputRef.current?.click()}
              >
                Upload photo
              </button>
            </div>
            <small className="field-hint">Take photo opens the live camera. Upload photo keeps the file picker.</small>
          </div>
        </div>

        {reportPhotoPreviewUrl ? (
          <div className="report-selected-photo">
            <img src={reportPhotoPreviewUrl} alt={`${selectedAirport.code} report preview`} />
            <div className="report-selected-photo-copy">
              <strong>{reportForm.photo?.name ?? 'Photo ready'}</strong>
              <p>
                This photo will post into the {selectedAirport.code} community feed and disappear after {REPORT_TTL_HOURS}{' '}
                hours.
              </p>
              <button type="button" className="report-clear-photo" onClick={clearPreparedPhoto}>
                Remove photo
              </button>
            </div>
          </div>
        ) : null}

        <label className="flight-field">
          <span>One-line note</span>
          <textarea
            className="field-control report-textarea"
            value={reportForm.note}
            onChange={(event) => setReportForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="Example: line wrapped back to the escalators"
          />
        </label>

        <div className="report-submit-row">
          <span className="report-file-label">
            {photoPrepareMode === 'processing'
              ? 'Optimizing photo for upload...'
              : photoPrepareMessage
                ? photoPrepareMessage
                : reportForm.photo
              ? `Photo ready: ${reportForm.photo.name} · auto-deletes in ${REPORT_TTL_HOURS} hours`
              : `Photo is optional · posts auto-delete in ${REPORT_TTL_HOURS} hours`}
          </span>
          <button
            className="primary-button flight-submit"
            type="submit"
            disabled={photoPrepareMode === 'processing' || reportSubmitMode === 'submitting'}
          >
            {photoPrepareMode === 'processing' ? 'Preparing photo...' : reportSubmitMode === 'submitting' ? 'Posting...' : 'Post Report'}
          </button>
        </div>
      </form>

      {reportSubmitMessage ? (
        <p className={reportSubmitMode === 'error' ? 'error-banner' : 'success-banner'}>{reportSubmitMessage}</p>
      ) : null}

      {photoPrepareMode === 'error' && photoPrepareMessage ? <p className="error-banner">{photoPrepareMessage}</p> : null}

      {reportsMode === 'error' ? <p className="error-banner">{reportsError}</p> : null}

      <div className="community-view-toggle" role="tablist" aria-label={`${selectedAirport.code} community views`}>
        <button
          type="button"
          className={`community-view-chip ${resolvedCommunityView === 'photos' ? 'community-view-chip-active' : ''}`}
          onClick={() => setCommunityView('photos')}
          aria-pressed={resolvedCommunityView === 'photos'}
        >
          Photo wall <span>{photoReports.length}</span>
        </button>
        <button
          type="button"
          className={`community-view-chip ${resolvedCommunityView === 'feed' ? 'community-view-chip-active' : ''}`}
          onClick={() => setCommunityView('feed')}
          aria-pressed={resolvedCommunityView === 'feed'}
        >
          Report feed <span>{reports.length}</span>
        </button>
      </div>

      {resolvedCommunityView === 'photos' ? (
        <div className="photo-wall-grid">
          {photoReports.length > 0 ? (
            photoReports.map((report) => {
              const imageUrl = resolveApiAssetUrl(report.photoUrl);

              if (!imageUrl) {
                return null;
              }

              return (
                <article key={report.id} className="photo-wall-card">
                  <CommunityPhotoPreview
                    className="photo-wall-image"
                    fallbackClassName="photo-wall-image-fallback"
                    imageUrl={imageUrl}
                    alt={`${report.airportCode} traveler photo from ${report.checkpoint}`}
                  />
                  <div className="photo-wall-badges">
                    <span>{report.queueLength}</span>
                    <span>{report.crowdLevel}</span>
                  </div>
                  <div className="photo-wall-copy">
                    <strong>{report.checkpoint}</strong>
                    <span>{formatReportLifetime(report.createdAt, report.expiresAt)}</span>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="empty-state">
              No checkpoint photos have been posted for {selectedAirport.code} yet. The first photo will appear here for{' '}
              {REPORT_TTL_HOURS} hours.
            </p>
          )}
        </div>
      ) : (
        <div className="report-list-grid">
          {reports.length > 0 ? (
            reports.map((report) => {
              const imageUrl = resolveApiAssetUrl(report.photoUrl);

              return (
                <article key={report.id} className="report-card">
                  <div className="report-card-head">
                    <div>
                      <strong>{report.checkpoint}</strong>
                      <p>{formatReportLifetime(report.createdAt, report.expiresAt)}</p>
                    </div>
                    <div className="source-list">
                      <span className="source-chip">{report.queueLength}</span>
                      <span className="source-chip">{report.crowdLevel}</span>
                    </div>
                  </div>

                  {report.note ? <p className="card-note">{report.note}</p> : null}

                  {imageUrl ? (
                    <CommunityPhotoPreview
                      className="report-photo"
                      fallbackClassName="report-photo-fallback"
                      imageUrl={imageUrl}
                      alt={`${report.airportCode} traveler report from ${report.checkpoint}`}
                    />
                  ) : null}
                </article>
              );
            })
          ) : (
            <p className="empty-state">
              No traveler reports yet for {selectedAirport.code}. The first post will stay live here for {REPORT_TTL_HOURS}{' '}
              hours, then auto-delete.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function ConcourseBoardPanel({
  selectedAirport,
  boardAirportClock,
  boardAirportTimeZoneShort,
  concourseBoardCounts,
  flightBoards,
  flightBoardsMode,
  flightBoardsError,
  concourseBoardPanels,
  selectedBoardFocus,
  onOpenBoardDetail,
}: ConcourseBoardPanelProps) {
  return (
    <section className="concourse-board-panel" aria-labelledby={`${selectedAirport.code}-concourse-board-heading`}>
      <div className="concourse-board-head">
        <div>
          <p className="section-kicker">Live concourse board</p>
          <h3 id={`${selectedAirport.code}-concourse-board-heading`}>{selectedAirport.code} terminal departures + arrivals</h3>
        </div>
        <p className="concourse-board-copy">
          This is the first board travelers should see. Tap any row to open the separated detailed board below.
        </p>
      </div>

      <div className="concourse-board-marquee">
        <div>
          <p className="board-marquee-label">{selectedAirport.code} concourse clock</p>
          <div className="board-marquee-clock">
            <strong>{boardAirportClock}</strong>
            <span>{boardAirportTimeZoneShort}</span>
          </div>
        </div>
        <div className="concourse-board-meta">
          <span>Upcoming departures {concourseBoardCounts.departures}</span>
          <span>Upcoming arrivals {concourseBoardCounts.arrivals}</span>
          {flightBoards ? <span>Updated {formatRelativeTime(flightBoards.fetchedAt)}</span> : null}
        </div>
      </div>

      {flightBoardsMode === 'error' ? <p className="error-banner">{flightBoardsError}</p> : null}

      {flightBoardsMode === 'loading' && !flightBoards ? (
        <p className="empty-state board-empty-state">Loading the live concourse board for {selectedAirport.code}.</p>
      ) : null}

      {flightBoardsMode === 'ready' ? (
        concourseBoardPanels.some((panel) => panel.visibleEntries.length > 0) ? (
          <div className="concourse-wall">
            {concourseBoardPanels.map((panel) => (
              <section
                key={panel.sectionKey}
                className="concourse-fids-panel"
                aria-labelledby={`${selectedAirport.code}-${panel.sectionKey}-wall-heading`}
              >
                <div className="concourse-fids-head">
                  <h4 id={`${selectedAirport.code}-${panel.sectionKey}-wall-heading`}>{panel.title}</h4>
                  <span>{panel.count} upcoming</span>
                </div>

                {panel.visibleEntries.length > 0 ? (
                  <div className="concourse-fids-table" role="table" aria-label={`${selectedAirport.code} ${panel.sectionKey} concourse board`}>
                    <div className="concourse-fids-row concourse-fids-row-head" role="row">
                      <span role="columnheader">{panel.timeColumns[0]}</span>
                      <span role="columnheader">{panel.timeColumns[1]}</span>
                      <span role="columnheader">Flight</span>
                      <span role="columnheader">{panel.routeLabel}</span>
                      <span role="columnheader">Gate</span>
                      <span role="columnheader">Remark</span>
                    </div>

                    <div className="concourse-fids-body" role="rowgroup">
                      {panel.visibleEntries.map((entry) => {
                        const isSelected =
                          selectedBoardFocus?.entryId === entry.id && selectedBoardFocus.sectionKey === panel.sectionKey;

                        return (
                          <button
                            key={`${panel.sectionKey}-preview-${entry.id}`}
                            type="button"
                            className={`concourse-fids-row concourse-fids-row-body ${isSelected ? 'concourse-fids-row-selected' : ''}`}
                            onClick={() => onOpenBoardDetail(panel.sectionKey, entry)}
                          >
                            <span className="concourse-fids-cell" data-label={panel.timeColumns[0]}>
                              {formatDenseBoardTime(entry.scheduledTimeLocal)}
                            </span>
                            <span className="concourse-fids-cell" data-label={panel.timeColumns[1]}>
                              {entry.latestTimeLocal && entry.latestTimeLocal !== entry.scheduledTimeLocal
                                ? formatDenseBoardTime(entry.latestTimeLocal)
                                : '--:--'}
                            </span>
                            <span className="concourse-fids-cell concourse-fids-cell-flight" data-label="Flight">
                              {entry.flightNumber}
                            </span>
                            <span className="concourse-fids-cell concourse-fids-cell-route" data-label={panel.routeLabel}>
                              {formatDenseBoardRoute(entry)}
                            </span>
                            <span className="concourse-fids-cell concourse-fids-cell-gate" data-label="Gate">
                              {entry.localGate ?? entry.localTerminal ?? '--'}
                            </span>
                            <span
                              className={`concourse-fids-cell concourse-fids-cell-remark concourse-fids-cell-remark-${entry.statusTone}`}
                              data-label="Remark"
                            >
                              {formatDenseBoardRemark(entry)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="empty-state board-empty-state">No live {panel.title.toLowerCase()} are listed right now.</p>
                )}

                {panel.hiddenCount > 0 ? (
                  <p className="board-section-note">
                    Showing the first {panel.visibleEntries.length}. {panel.hiddenCount} more are available.
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        ) : (
          <p className="empty-state board-empty-state">
            No live upcoming flights are listed for {selectedAirport.code} in the current board snapshot.
          </p>
        )
      ) : null}
    </section>
  );
}

export function FlightBoardDetailPanel({
  selectedBoardEntry,
  selectedBoardFocus,
  flightBoards,
  boardAirportTimeZoneShort,
  onDismiss,
}: FlightBoardDetailPanelProps) {
  if (!selectedBoardEntry) {
    return null;
  }

  return (
    <section className="dashboard-panel board-panel board-panel-compact" id="flight-board-detail">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Selected flight detail</p>
          <h2>
            {selectedBoardEntry.flightNumber} {formatBoardDirectionLabel(selectedBoardFocus?.sectionKey ?? 'departures')}
          </h2>
        </div>
        <p className="section-copy">This panel stays hidden until you tap one row from the terminal board above.</p>
      </div>

      <div className="focused-board-card focused-board-card-compact">
        <div className="focused-board-topline">
          <div>
            <p className="focused-board-kicker">
              {formatBoardDirectionLabel(selectedBoardFocus?.sectionKey ?? 'departures')}
            </p>
            <h3>{selectedBoardEntry.flightNumber}</h3>
            <p className="focused-board-route">{formatBoardRouteLabel(selectedBoardEntry)}</p>
          </div>

          <button type="button" className="detail-dismiss-button" onClick={onDismiss}>
            Hide detail
          </button>
        </div>

        <div className="focused-board-metrics">
          <div>
            <span>Time</span>
            <strong>{formatBoardTime(selectedBoardEntry.scheduledTimeLocal)}</strong>
            <small>{formatBoardTimeMeta(selectedBoardEntry)}</small>
          </div>
          <div>
            <span>Gate</span>
            <strong>{selectedBoardEntry.localGate ?? '--'}</strong>
            <small>Terminal {selectedBoardEntry.localTerminal ?? '--'}</small>
          </div>
          <div>
            <span>Status</span>
            <strong>{selectedBoardEntry.statusText}</strong>
            <small>{formatBoardStatusMeta(selectedBoardEntry) ?? 'Live board snapshot'}</small>
          </div>
          <div>
            <span>Airline</span>
            <strong>{selectedBoardEntry.airlineName ?? 'Airline n/a'}</strong>
            <small>{flightBoards?.source.label ?? 'Live board snapshot'}</small>
          </div>
          <div>
            <span>Airport</span>
            <strong>{selectedBoardEntry.counterpartAirportCode ?? '--'}</strong>
            <small>{selectedBoardEntry.counterpartAirportName ?? selectedBoardEntry.counterpartAirportCity ?? 'Airport n/a'}</small>
          </div>
          <div>
            <span>Extras</span>
            <strong>{selectedBoardEntry.localBaggageClaim ? `Bag ${selectedBoardEntry.localBaggageClaim}` : 'No bag info'}</strong>
            <small>
              {selectedBoardEntry.codeshares[0] ? `Codeshare ${selectedBoardEntry.codeshares[0]}` : boardAirportTimeZoneShort}
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CheckpointDetailPanel({ selectedAirport, selectedCoverageTier }: CheckpointDetailPanelProps) {
  return (
    <section className="dashboard-panel" id="checkpoint-detail">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Selected airport detail</p>
          <h2>{selectedAirport.code} checkpoint picture</h2>
        </div>
        <p className="section-copy">
          Everything in this section stays pinned to the airport you selected above, so you can scan one airport quickly
          instead of comparing a full launch board.
        </p>
      </div>

      <p className="detail-recommendation">{selectedAirport.recommendation}</p>
      <p className="detail-insight">{selectedAirport.insight}</p>

      <div className="detail-meta">
        <div>
          <span>Wait source</span>
          <strong>{formatWaitSourceLabel(selectedAirport.waitTimeSource)}</strong>
        </div>
        <div>
          <span>Ops source</span>
          <strong>{formatOpsSourceLabel(selectedAirport.riskSource)}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{formatRelativeTime(selectedAirport.updatedAt)}</strong>
        </div>
      </div>

      <div className="checkpoint-list">
        {selectedAirport.checkpoints.length > 0 ? (
          selectedAirport.checkpoints.map((checkpoint) => (
            <div key={checkpoint.id} className="checkpoint-row">
              <div>
                <p className="checkpoint-name">{checkpoint.name}</p>
                <p className="checkpoint-subtext">
                  {checkpoint.terminal} · {checkpoint.message}
                </p>
              </div>
              <div className="checkpoint-right">
                <span className={`checkpoint-tag ${checkpointTag(checkpoint)}`}>{checkpoint.status}</span>
                <strong>{checkpoint.displayWait}</strong>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">Detailed checkpoint data is not available for this airport yet.</p>
        )}
      </div>

      <div className="source-list">
        <span className={`source-chip source-chip-tier source-chip-tier-${selectedCoverageTier}`}>
          {formatCoverageTierLabel(selectedCoverageTier)}
        </span>
        {selectedAirport.signals.map((signal) => (
          <span key={signal} className="source-chip">
            {signal}
          </span>
        ))}
        {selectedAirport.dataSources.map((source) => (
          <span key={source} className="source-chip source-chip-strong">
            {source}
          </span>
        ))}
      </div>
    </section>
  );
}

export function FlightRiskPanel({
  airports,
  flightForm,
  setFlightForm,
  flightOriginAirport,
  flightOriginTimeZoneShort,
  flightRiskMode,
  flightRiskError,
  flightRisk,
  routeLabel,
  onSubmit,
  onSelectAirport,
}: FlightRiskPanelProps) {
  return (
    <article className="info-panel accent-panel" id="flight-risk">
      <p className="section-kicker">Flight risk prototype</p>
      <h2>Route-level Delay Risk</h2>
      <p className="detail-insight">
        This pass models itinerary risk from the selected origin airport, current queue pressure, FAA status, and the
        departure window you choose.
      </p>

      <form className="flight-form" onSubmit={onSubmit}>
        <div className="flight-form-row">
          <label className="flight-field">
            <span>Origin</span>
            <select
              className="field-control"
              value={flightForm.origin}
              onChange={(event) => onSelectAirport(event.target.value as AirportCode)}
            >
              {airports.map((airport) => (
                <option key={airport.code} value={airport.code}>
                  {airport.code} · {airport.city}
                </option>
              ))}
            </select>
          </label>

          <label className="flight-field">
            <span>Destination</span>
            <input
              className="field-control"
              type="text"
              value={flightForm.destination}
              onChange={(event) => setFlightForm((current) => ({ ...current, destination: event.target.value }))}
              placeholder="LAX or New York"
            />
          </label>
        </div>

        <div className="flight-form-row flight-form-row-compact">
          <label className="flight-field">
            <span>
              Departure ({flightOriginAirport.code} local time · {flightOriginTimeZoneShort})
            </span>
            <input
              className="field-control"
              type="datetime-local"
              value={flightForm.departureLocalTime}
              onChange={(event) =>
                setFlightForm((current) => ({
                  ...current,
                  departureLocalTime: event.target.value,
                }))
              }
            />
            <small className="field-hint">
              Showing the current time in {flightOriginAirport.code} local time. Change it to your planned departure.
            </small>
          </label>

          <button className="primary-button flight-submit" type="submit">
            Run Risk
          </button>
        </div>
      </form>

      {flightRiskMode === 'error' ? <p className="error-banner">{flightRiskError}</p> : null}

      {flightRisk ? (
        <div className="flight-summary">
          <div className="flight-summary-head">
            <div>
              <p className="panel-label">Modeled itinerary</p>
              <h3>{routeLabel}</h3>
            </div>
            <span className={`status-badge status-badge-${flightRiskMode === 'loading' ? 'loading' : 'live'}`}>
              {flightRiskMode === 'loading' ? 'Refreshing' : 'Modeled now'}
            </span>
          </div>

          <div className="flight-risk-metrics">
            <div>
              <span>Delay Risk</span>
              <strong>{flightRisk.delayRisk}%</strong>
            </div>
            <div>
              <span>Cancel Risk</span>
              <strong>{flightRisk.cancelRisk}%</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{flightRisk.confidence}</strong>
            </div>
          </div>

          <div className="flight-summary-meta">
            <span>{flightRisk.departureWindowLabel}</span>
            <span>Airport wait {flightRisk.airportWaitDisplay}</span>
            <span>Queue {flightRisk.airportWaitSource}</span>
            <span>Ops {flightRisk.airportRiskSource === 'live' ? 'FAA live' : flightRisk.airportRiskSource}</span>
          </div>

          {flightRisk.signals.length > 0 ? (
            <div className="source-list">
              {flightRisk.signals.map((signal) => (
                <span key={signal} className="source-chip">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}

          <p className="detail-recommendation">{flightRisk.recommendation}</p>
          <p className="detail-insight">{flightRisk.explanation}</p>

          <div className="source-list">
            {flightRisk.drivers.map((driver) => (
              <span key={driver} className="source-chip source-chip-strong">
                {driver}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function AirspacePanel({
  selectedAirport,
  selectedCoverageTier,
  focusedTraffic,
  activeTrafficAircraft,
  activeTrafficAircraftId,
  activeTrafficBoardMatch,
  selectedAirportAirborneSummary,
  selectedAirportTrafficSummary,
  trackerLinks,
  airportTrafficError,
  onMapBackgroundClick,
  onAircraftEnter,
  onAircraftLeave,
  onAircraftClick,
}: AirspacePanelProps) {
  return (
    <details className="airspace-panel airspace-panel-foldout">
      <summary className="airspace-panel-summary">
        <div>
          <p className="section-kicker">Selected airport traffic</p>
          <h2>{selectedAirport.code} nearby airspace</h2>
          <p className="airspace-panel-summary-copy">
            Open this only if you want the live aircraft map, nearby counts, and external tracker links for{' '}
            {selectedAirport.code}.
          </p>
        </div>
        <span className="airspace-panel-summary-toggle">Show live map</span>
      </summary>

      <div className="airspace-panel-body">
        <div className="airspace-layout">
          <div className="airspace-frame">
            <div className="airspace-stack">
              <div className="focus-panel">
                <div className="focus-panel-head">
                  <div>
                    <p className="panel-label">Airport zoom</p>
                    <h3>{selectedAirport.code} nearby aircraft</h3>
                  </div>
                  <span className="source-chip source-chip-strong">{Math.round(focusedTraffic.radiusNm)} nm radius</span>
                </div>

                <div
                  className="focus-map"
                  aria-label={`${selectedAirport.code} zoomed airspace`}
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      onMapBackgroundClick();
                    }
                  }}
                >
                  <div className="focus-ring focus-ring-outer" />
                  <div className="focus-ring focus-ring-mid" />
                  <div className="focus-ring focus-ring-inner" />

                  <div className="focus-airport-core">
                    <span className="focus-airport-dot" />
                    <span className="focus-airport-label">{selectedAirport.code}</span>
                  </div>

                  {activeTrafficAircraft ? (
                    <article className="focus-aircraft-callout" aria-live="polite">
                      <div className="focus-aircraft-callout-head">
                        <div>
                          <p className="panel-label">Live aircraft</p>
                          <h4>{activeTrafficAircraft.callsign ?? activeTrafficAircraft.id.toUpperCase()}</h4>
                        </div>
                        <span className={`source-chip focus-chip-${activeTrafficAircraft.kind}`}>
                          {formatTrafficKindLabel(activeTrafficAircraft.kind)}
                        </span>
                      </div>
                      <p className="focus-aircraft-route">
                        {activeTrafficBoardMatch
                          ? activeTrafficBoardMatch.sectionKey === 'arrivals'
                            ? `From ${formatBoardRouteLabel(activeTrafficBoardMatch.entry)}`
                            : `To ${formatBoardRouteLabel(activeTrafficBoardMatch.entry)}`
                          : 'This live aircraft has not matched to the airport board yet.'}
                      </p>
                    </article>
                  ) : null}

                  {focusedTraffic.aircraft.map((aircraft) => {
                    const isAircraftActive = aircraft.id === activeTrafficAircraftId;

                    return (
                      <button
                        key={`${selectedAirport.code}-${aircraft.id}`}
                        type="button"
                        className={`focus-aircraft focus-aircraft-${aircraft.kind} ${isAircraftActive ? 'focus-aircraft-active' : ''}`}
                        style={{
                          left: `${aircraft.position.x}%`,
                          top: `${aircraft.position.y}%`,
                          transform: `rotate(${aircraft.heading ?? 0}deg)`,
                        }}
                        onMouseEnter={() => onAircraftEnter(aircraft.id)}
                        onMouseLeave={() => onAircraftLeave(aircraft.id)}
                        onFocus={() => onAircraftEnter(aircraft.id)}
                        onBlur={() => onAircraftLeave(aircraft.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAircraftClick(aircraft.id);
                        }}
                        aria-label={`${aircraft.callsign ?? aircraft.id}, ${aircraft.operatorName ?? 'operator unknown'}, ${formatTrafficKindLabel(aircraft.kind)}, ${formatDistanceNm(aircraft.distanceNm)}`}
                        title={`${aircraft.callsign ?? aircraft.id} · ${formatDistanceNm(aircraft.distanceNm)}`}
                      />
                    );
                  })}
                </div>

                <div className="focus-legend">
                  <span className="source-chip focus-chip-approaching">Approaching {focusedTraffic.approachingCount}</span>
                  <span className="source-chip focus-chip-outbound">Outbound {focusedTraffic.outboundCount}</span>
                  <span className="source-chip focus-chip-transit">Transit {focusedTraffic.transitCount}</span>
                </div>
              </div>
            </div>
          </div>

          <aside className="airspace-sidebar">
            <div className="airspace-metrics">
              <div>
                <span>Airborne nearby</span>
                <strong>{selectedAirportAirborneSummary}</strong>
              </div>
              <div>
                <span>Tracked sample</span>
                <strong>{selectedAirportTrafficSummary}</strong>
              </div>
              <div>
                <span>Coverage</span>
                <strong>{formatCoverageTierLabel(selectedCoverageTier)}</strong>
              </div>
            </div>

            <p className="detail-insight">
              Board fields only appear when the public airport source exposes them, and nearby traffic is projected for up
              to {MAX_TRAFFIC_EXTRAPOLATION_SECONDS} seconds between OpenSky updates.
            </p>

            <div className="focus-summary-grid">
              <div>
                <span>Visible on map</span>
                <strong>{focusedTraffic.aircraft.length}</strong>
              </div>
              <div>
                <span>Approaching</span>
                <strong>{focusedTraffic.approachingCount}</strong>
              </div>
              <div>
                <span>Outbound</span>
                <strong>{focusedTraffic.outboundCount}</strong>
              </div>
              <div>
                <span>Transit</span>
                <strong>{focusedTraffic.transitCount}</strong>
              </div>
            </div>

            <div className="source-list">
              {trackerLinks.map((link) => (
                <a key={link.label} className="source-chip source-chip-link" href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>

            {airportTrafficError ? <p className="error-banner">{airportTrafficError}</p> : null}
          </aside>
        </div>
      </div>
    </details>
  );
}
