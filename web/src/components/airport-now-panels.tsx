import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react';
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

type AirportPickerPanelProps = {
  airports: AirportStatus[];
  selectedCode: AirportCode;
  selectedCoverageTier: AirportCoverageTier;
  onSelectAirport: (code: AirportCode) => void;
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

        <div className="hero-switcher">
          <div className="airport-switcher-head">
            <p className="panel-label">Departure airport tabs</p>
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
  return (
    <section className="info-panel community-priority-panel" id="community-reports">
      <div className="community-priority-head">
        <div>
          <p className="section-kicker">Community layer</p>
          <h2>Post what the line looks like right now</h2>
        </div>
        <div className="community-priority-meta">
          <span>{selectedAirport.code}</span>
          <span>{selectedAirport.reports} reports</span>
          <span>{selectedAirport.photos} photos</span>
        </div>
      </div>

      <p className="detail-insight">
        Reports and photos are stored on the Airport Now API for this airport feed, shown to other travelers here, and
        auto-delete after {REPORT_TTL_HOURS} hours.
      </p>

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
                setSelectedReportPhoto(event.target.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
            <input
              ref={reportUploadInputRef}
              className="report-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                setSelectedReportPhoto(event.target.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
            <div className="report-photo-actions">
              <button
                type="button"
                className="secondary-button report-photo-button"
                onClick={() => reportCameraInputRef.current?.click()}
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
            <small className="field-hint">On mobile, Take photo opens the camera directly.</small>
          </div>
        </div>

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
            {reportForm.photo
              ? `Photo ready: ${reportForm.photo.name} · auto-deletes in ${REPORT_TTL_HOURS} hours`
              : `Photo is optional · posts auto-delete in ${REPORT_TTL_HOURS} hours`}
          </span>
          <button className="primary-button flight-submit" type="submit">
            {reportSubmitMode === 'submitting' ? 'Posting...' : 'Post Report'}
          </button>
        </div>
      </form>

      {reportSubmitMessage ? (
        <p className={reportSubmitMode === 'error' ? 'error-banner' : 'success-banner'}>{reportSubmitMessage}</p>
      ) : null}

      {reportsMode === 'error' ? <p className="error-banner">{reportsError}</p> : null}

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
                  <img
                    className="report-photo"
                    src={imageUrl}
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
    </section>
  );
}

export function AirportPickerPanel({
  airports,
  selectedCode,
  selectedCoverageTier,
  onSelectAirport,
}: AirportPickerPanelProps) {
  return (
    <section className="dashboard-panel airport-picker-panel" id="airport-picker">
      <div className="focus-panel-head">
        <div>
          <p className="panel-label">Your airport</p>
          <h3>Select departure airport</h3>
        </div>
        <span className={`source-chip source-chip-tier source-chip-tier-${selectedCoverageTier}`}>
          {formatCoverageTierLabel(selectedCoverageTier)}
        </span>
      </div>

      <p className="detail-insight">
        Choose one airport here first. The rest of the page stays pinned to that airport instead of asking people to
        browse a nationwide view.
      </p>

      <label className="flight-field">
        <span>Departure airport</span>
        <select
          className="field-control"
          value={selectedCode}
          onChange={(event) => onSelectAirport(event.target.value as AirportCode)}
        >
          {airports.map((airport) => (
            <option key={airport.code} value={airport.code}>
              {airport.code} · {airport.city}
            </option>
          ))}
        </select>
      </label>
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
