import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AirportCode } from '../../shared/airport-status';
import { createAirportReport } from './lib/airport-api';
import {
  AirspacePanel,
  CheckpointDetailPanel,
  CommunityPanel,
  ConcourseBoardPanel,
  FlightBoardDetailPanel,
  FlightRiskPanel,
  HeroHeader,
  SelectedAirportStrip,
} from './components/airport-now-panels';
import {
  buildConcourseBoardPanels,
  buildFocusedTrafficSummary,
  buildInitialReportForm,
  buildRouteLabel,
  buildStatusMetrics,
  buildTrackerLinks,
  fallbackAirports,
  filterAvailableTrafficIds,
  findActiveTrafficAircraft,
  findAirportByCode,
  findSelectedBoardEntry,
  formatAirportClock,
  getAirportCoverageTier,
  getAirportTimeZoneShort,
  getBoardEntryCounts,
  getDefaultDepartureLocalTime,
  getSuggestedDestination,
  matchAircraftToBoard,
  projectTrafficSnapshotAircraft,
  TRAFFIC_TICK_INTERVAL_MS,
  type FlightFormState,
  type ReportFormState,
  type ReportSubmitMode,
  type SelectedBoardFocus,
} from './lib/airport-now';
import {
  useAirportReports,
  useAirportSnapshot,
  useAirportTraffic,
  useCommunityPhotoWall,
  useFlightBoards,
  useFlightRisk,
} from './hooks/use-airport-now-data';

const SELECTED_AIRPORT_STORAGE_KEY = 'airport-now:selected-airport';

function getInitialSelectedAirportCode(): AirportCode {
  if (typeof window === 'undefined') {
    return 'ATL';
  }

  const storedCode = window.localStorage.getItem(SELECTED_AIRPORT_STORAGE_KEY)?.toUpperCase();
  const matchedAirport = storedCode ? fallbackAirports.find((airport) => airport.code === storedCode) : null;

  return matchedAirport?.code ?? 'ATL';
}

function App() {
  const { airports, mode, error, refresh } = useAirportSnapshot();
  const initialSelectedCode = getInitialSelectedAirportCode();
  const initialSelectedAirport = findAirportByCode(fallbackAirports, initialSelectedCode);
  const initialFlightForm: FlightFormState = {
    origin: initialSelectedCode,
    destination: getSuggestedDestination(initialSelectedCode),
    departureLocalTime: getDefaultDepartureLocalTime(initialSelectedCode),
  };

  const [selectedCode, setSelectedCode] = useState<AirportCode>(initialSelectedCode);
  const [trafficClock, setTrafficClock] = useState<number>(() => Date.now());
  const [hoveredTrafficAircraftId, setHoveredTrafficAircraftId] = useState<string | null>(null);
  const [pinnedTrafficAircraftId, setPinnedTrafficAircraftId] = useState<string | null>(null);
  const [selectedBoardFocus, setSelectedBoardFocus] = useState<SelectedBoardFocus | null>(null);
  const [reportSubmitMode, setReportSubmitMode] = useState<ReportSubmitMode>('idle');
  const [reportSubmitMessage, setReportSubmitMessage] = useState<string | null>(null);
  const [airportSwitcherCanScrollLeft, setAirportSwitcherCanScrollLeft] = useState(false);
  const [airportSwitcherCanScrollRight, setAirportSwitcherCanScrollRight] = useState(false);
  const [flightForm, setFlightForm] = useState<FlightFormState>(initialFlightForm);
  const [flightQuery, setFlightQuery] = useState<FlightFormState>(initialFlightForm);
  const [reportForm, setReportForm] = useState<ReportFormState>(() => buildInitialReportForm(initialSelectedAirport));
  const airportSwitcherRailRef = useRef<HTMLDivElement | null>(null);
  const reportCameraInputRef = useRef<HTMLInputElement | null>(null);
  const reportUploadInputRef = useRef<HTMLInputElement | null>(null);

  const { airportTraffic, airportTrafficMode, airportTrafficError } = useAirportTraffic(selectedCode);
  const { flightBoards, flightBoardsMode, flightBoardsError } = useFlightBoards(selectedCode);
  const { flightRisk, flightRiskMode, flightRiskError } = useFlightRisk(flightQuery);
  const {
    reports,
    reportsMode,
    reportsError,
    reloadReports,
  } = useAirportReports(selectedCode);
  const {
    photoReports: communityPhotoWallReports,
    photoWallMode,
    photoWallError,
    reloadPhotoWall,
  } = useCommunityPhotoWall();

  const selectedAirport = useMemo(() => findAirportByCode(airports, selectedCode), [airports, selectedCode]);
  const selectableAirports = useMemo(
    () =>
      [...airports].sort(
        (left, right) => left.code.localeCompare(right.code) || left.city.localeCompare(right.city),
      ),
    [airports],
  );
  const selectedCoverageTier = getAirportCoverageTier(selectedAirport);
  const trackerLinks = useMemo(() => buildTrackerLinks(selectedAirport.code), [selectedAirport.code]);
  const boardAirportTimeZoneShort =
    flightBoards?.airport.timeZoneShort ?? getAirportTimeZoneShort(selectedAirport.code);
  const boardAirportClock = useMemo(
    () => formatAirportClock(trafficClock, selectedAirport.code),
    [selectedAirport.code, trafficClock],
  );
  const concourseBoardCounts = useMemo(
    () => ({
      departures: getBoardEntryCounts(flightBoards?.departures ?? [], trafficClock).upcoming,
      arrivals: getBoardEntryCounts(flightBoards?.arrivals ?? [], trafficClock).upcoming,
    }),
    [flightBoards, trafficClock],
  );
  const concourseBoardPanels = useMemo(
    () => buildConcourseBoardPanels(flightBoards, trafficClock),
    [flightBoards, trafficClock],
  );
  const selectedBoardEntry = useMemo(
    () => findSelectedBoardEntry(flightBoards, selectedBoardFocus),
    [flightBoards, selectedBoardFocus],
  );
  const displayAirportTrafficAircraft = useMemo(
    () => projectTrafficSnapshotAircraft(airportTraffic, trafficClock),
    [airportTraffic, trafficClock],
  );
  const focusedTrafficSummary = useMemo(
    () => buildFocusedTrafficSummary(displayAirportTrafficAircraft, selectedAirport.code),
    [displayAirportTrafficAircraft, selectedAirport.code],
  );
  const flightOriginAirport = useMemo(
    () => findAirportByCode(airports, flightForm.origin),
    [airports, flightForm.origin],
  );
  const flightOriginTimeZoneShort = useMemo(
    () => getAirportTimeZoneShort(flightForm.origin),
    [flightForm.origin],
  );
  const reportCheckpointOptions = useMemo(
    () => [...new Set(selectedAirport.checkpoints.map((checkpoint) => checkpoint.name))],
    [selectedAirport.checkpoints],
  );
  const hasStructuredCheckpointOptions = reportCheckpointOptions.length > 0;
  const selectedAirportTrafficSummary =
    airportTrafficMode === 'live' && airportTraffic
      ? `${airportTraffic.sampleCount} aircraft`
      : airportTrafficMode === 'error'
        ? 'Unavailable'
        : 'Loading';
  const selectedAirportAirborneSummary =
    airportTrafficMode === 'live' && airportTraffic
      ? airportTraffic.airborneCount.toLocaleString()
      : airportTrafficMode === 'error'
        ? 'Unavailable'
        : 'Loading';
  const activeTrafficAircraftId = hoveredTrafficAircraftId ?? pinnedTrafficAircraftId;
  const activeTrafficAircraft = useMemo(
    () => findActiveTrafficAircraft(focusedTrafficSummary, activeTrafficAircraftId),
    [focusedTrafficSummary, activeTrafficAircraftId],
  );
  const activeTrafficBoardMatch = useMemo(
    () => matchAircraftToBoard(activeTrafficAircraft, flightBoards),
    [activeTrafficAircraft, flightBoards],
  );
  const selectedStatusMetrics = useMemo(
    () =>
      buildStatusMetrics(selectedAirport, selectedCoverageTier, selectedAirportTrafficSummary, {
        reports: reports.length,
        photos: reports.filter((report) => Boolean(report.photoUrl)).length,
      }),
    [reports, selectedAirport, selectedCoverageTier, selectedAirportTrafficSummary],
  );
  const routeLabel = buildRouteLabel(flightRisk, flightForm);

  const resetReportPhotoInputs = () => {
    if (reportCameraInputRef.current) {
      reportCameraInputRef.current.value = '';
    }

    if (reportUploadInputRef.current) {
      reportUploadInputRef.current.value = '';
    }
  };

  const setSelectedReportPhoto = (photo: File | null) => {
    setReportForm((current) => ({
      ...current,
      photo,
    }));
  };

  const selectAirport = (nextOrigin: AirportCode) => {
    const nextDestination =
      flightForm.destination.trim().toUpperCase() === nextOrigin
        ? getSuggestedDestination(nextOrigin)
        : flightForm.destination;
    const nextFlightForm = {
      ...flightForm,
      origin: nextOrigin,
      destination: nextDestination,
      departureLocalTime: getDefaultDepartureLocalTime(nextOrigin),
    };

    setSelectedCode(nextOrigin);
    setFlightForm(nextFlightForm);
    setFlightQuery(nextFlightForm);
  };

  const openBoardDetail = (sectionKey: SelectedBoardFocus['sectionKey'], entry: { id: string }) => {
    const isSameEntry =
      selectedBoardFocus?.entryId === entry.id && selectedBoardFocus.sectionKey === sectionKey;

    if (isSameEntry) {
      setSelectedBoardFocus(null);
      return;
    }

    setSelectedBoardFocus({ entryId: entry.id, sectionKey });

    window.requestAnimationFrame(() => {
      document.getElementById('flight-board-detail')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const togglePinnedTrafficAircraft = (aircraftId: string) => {
    setPinnedTrafficAircraftId((current) => (current === aircraftId ? null : aircraftId));
    setHoveredTrafficAircraftId(aircraftId);
  };

  const syncAirportSwitcherScrollState = () => {
    const rail = airportSwitcherRailRef.current;

    if (!rail) {
      return;
    }

    const nextCanScrollLeft = rail.scrollLeft > 8;
    const nextCanScrollRight = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 8;

    setAirportSwitcherCanScrollLeft((current) => (current === nextCanScrollLeft ? current : nextCanScrollLeft));
    setAirportSwitcherCanScrollRight((current) => (current === nextCanScrollRight ? current : nextCanScrollRight));
  };

  const scrollAirportSwitcher = (direction: 'left' | 'right') => {
    const rail = airportSwitcherRailRef.current;

    if (!rail) {
      return;
    }

    const travel = Math.max(rail.clientWidth * 0.72, 240);

    rail.scrollBy({
      left: direction === 'left' ? -travel : travel,
      behavior: 'smooth',
    });
  };

  const handleReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportSubmitMode('submitting');
    setReportSubmitMessage(null);

    const formData = new FormData();
    formData.set('airportCode', selectedCode);
    formData.set('checkpoint', reportForm.checkpoint);
    formData.set('queueLength', reportForm.queueLength);
    formData.set('crowdLevel', reportForm.crowdLevel);
    formData.set('note', reportForm.note);

    if (reportForm.photo) {
      formData.set('photo', reportForm.photo);
    }

    try {
      await createAirportReport(formData);
      const [snapshotRefreshed, reportsRefreshed] = await Promise.all([refresh(), reloadReports(), reloadPhotoWall()]);
      setReportSubmitMode('success');
      setReportSubmitMessage(
        snapshotRefreshed && reportsRefreshed
          ? 'Report posted. The airport card and report list have been refreshed.'
          : snapshotRefreshed || reportsRefreshed
            ? 'Report posted. Part of the page refreshed, but one live panel is still catching up.'
            : 'Report posted. The live panels did not refresh yet, so reload in a moment if this view looks stale.',
      );
      setReportForm((current) => ({
        ...current,
        note: '',
        photo: null,
        checkpoint: selectedAirport.checkpoints[0]?.name ?? current.checkpoint,
      }));
      resetReportPhotoInputs();
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to submit report right now.';

      setReportSubmitMode('error');
      setReportSubmitMessage(message);
    }
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTrafficClock(Date.now());
    }, TRAFFIC_TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setSelectedBoardFocus(null);
  }, [selectedCode]);

  useEffect(() => {
    window.localStorage.setItem(SELECTED_AIRPORT_STORAGE_KEY, selectedCode);
  }, [selectedCode]);

  useEffect(() => {
    const rail = airportSwitcherRailRef.current;

    if (!rail) {
      return;
    }

    const handleScroll = () => {
      syncAirportSwitcherScrollState();
    };

    handleScroll();
    rail.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      rail.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [airports.length]);

  useEffect(() => {
    const rail = airportSwitcherRailRef.current;

    if (!rail) {
      return;
    }

    const selectedTab = rail.querySelector<HTMLElement>(`[data-airport-code="${selectedCode}"]`);
    selectedTab?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });

    window.requestAnimationFrame(() => {
      syncAirportSwitcherScrollState();
    });
  }, [selectedCode, airports.length]);

  useEffect(() => {
    setReportForm((current) => ({
      ...current,
      checkpoint: selectedAirport.checkpoints[0]?.name ?? `${selectedCode} main checkpoint`,
      photo: null,
    }));
    setReportSubmitMode('idle');
    setReportSubmitMessage(null);
    resetReportPhotoInputs();
  }, [selectedAirport.checkpoints, selectedCode]);

  useEffect(() => {
    setHoveredTrafficAircraftId(null);
    setPinnedTrafficAircraftId(null);
  }, [selectedCode]);

  useEffect(() => {
    const availableAircraftIds = filterAvailableTrafficIds(focusedTrafficSummary);

    if (hoveredTrafficAircraftId && !availableAircraftIds.has(hoveredTrafficAircraftId)) {
      setHoveredTrafficAircraftId(null);
    }

    if (pinnedTrafficAircraftId && !availableAircraftIds.has(pinnedTrafficAircraftId)) {
      setPinnedTrafficAircraftId(null);
    }
  }, [focusedTrafficSummary, hoveredTrafficAircraftId, pinnedTrafficAircraftId]);

  return (
    <div className="app-shell">
      <div className="background-grid" />

      <HeroHeader
        airports={selectableAirports}
        selectedCode={selectedCode}
        onSelectAirport={selectAirport}
        mode={mode}
        error={error}
        selectedStatusMetrics={selectedStatusMetrics}
        communityPhotoWallReports={communityPhotoWallReports}
        photoWallMode={photoWallMode}
        photoWallError={photoWallError}
        airportSwitcherCanScrollLeft={airportSwitcherCanScrollLeft}
        airportSwitcherCanScrollRight={airportSwitcherCanScrollRight}
        onScrollAirportSwitcher={scrollAirportSwitcher}
        airportSwitcherRailRef={airportSwitcherRailRef}
      />

      <SelectedAirportStrip selectedAirport={selectedAirport} selectedCoverageTier={selectedCoverageTier} />

      <CommunityPanel
        selectedAirport={selectedAirport}
        hasStructuredCheckpointOptions={hasStructuredCheckpointOptions}
        reportCheckpointOptions={reportCheckpointOptions}
        reportForm={reportForm}
        setReportForm={setReportForm}
        reportSubmitMode={reportSubmitMode}
        reportSubmitMessage={reportSubmitMessage}
        reportsMode={reportsMode}
        reportsError={reportsError}
        reports={reports}
        reportCameraInputRef={reportCameraInputRef}
        reportUploadInputRef={reportUploadInputRef}
        setSelectedReportPhoto={setSelectedReportPhoto}
        onSubmit={handleReportSubmit}
      />

      <ConcourseBoardPanel
        selectedAirport={selectedAirport}
        boardAirportClock={boardAirportClock}
        boardAirportTimeZoneShort={boardAirportTimeZoneShort}
        concourseBoardCounts={concourseBoardCounts}
        flightBoards={flightBoards}
        flightBoardsMode={flightBoardsMode}
        flightBoardsError={flightBoardsError}
        concourseBoardPanels={concourseBoardPanels}
        selectedBoardFocus={selectedBoardFocus}
        onOpenBoardDetail={openBoardDetail}
      />

      <main className="content-grid">
        <section className="main-stack">
          <FlightBoardDetailPanel
            selectedBoardEntry={selectedBoardEntry}
            selectedBoardFocus={selectedBoardFocus}
            flightBoards={flightBoards}
            boardAirportTimeZoneShort={boardAirportTimeZoneShort}
            onDismiss={() => setSelectedBoardFocus(null)}
          />

          <CheckpointDetailPanel
            selectedAirport={selectedAirport}
            selectedCoverageTier={selectedCoverageTier}
          />

          <section className="side-stack">
            <FlightRiskPanel
              airports={selectableAirports}
              flightForm={flightForm}
              setFlightForm={setFlightForm}
              flightOriginAirport={flightOriginAirport}
              flightOriginTimeZoneShort={flightOriginTimeZoneShort}
              flightRiskMode={flightRiskMode}
              flightRiskError={flightRiskError}
              flightRisk={flightRisk}
              routeLabel={routeLabel}
              onSubmit={(event) => {
                event.preventDefault();
                setFlightQuery(flightForm);
              }}
              onSelectAirport={selectAirport}
            />
          </section>
        </section>
      </main>

      <AirspacePanel
        selectedAirport={selectedAirport}
        selectedCoverageTier={selectedCoverageTier}
        focusedTraffic={focusedTrafficSummary}
        activeTrafficAircraft={activeTrafficAircraft}
        activeTrafficAircraftId={activeTrafficAircraftId}
        activeTrafficBoardMatch={activeTrafficBoardMatch}
        selectedAirportAirborneSummary={selectedAirportAirborneSummary}
        selectedAirportTrafficSummary={selectedAirportTrafficSummary}
        trackerLinks={trackerLinks}
        airportTrafficError={airportTrafficError}
        onMapBackgroundClick={() => setPinnedTrafficAircraftId(null)}
        onAircraftEnter={(aircraftId) => setHoveredTrafficAircraftId(aircraftId)}
        onAircraftLeave={(aircraftId) =>
          setHoveredTrafficAircraftId((current) => (current === aircraftId ? null : current))
        }
        onAircraftClick={togglePinnedTrafficAircraft}
      />
    </div>
  );
}

export default App;
