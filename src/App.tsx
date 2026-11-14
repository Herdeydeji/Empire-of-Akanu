import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { KingdomSelectionModal } from './components/KingdomSelectionModal';
import { MainMenu } from './components/MainMenu';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { AkanuEngine } from './engine/AkanuEngine';
import { soundEngine } from './engine/audio/soundEngine';
import {
  createNewKingdomSave,
  defaultPersistence,
} from './engine/persistence/saveSystem';
import {
  AIDifficulty,
  EconomyNotification,
  GameMode,
  GameSettings,
  GameShellScreen,
  KingdomId,
  PlacementPreviewState,
  RegionId,
  SaveGameData,
  SelectableEntity,
  TouchCommandMode,
} from './types/game';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AkanuEngine | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() =>
    defaultPersistence.loadSettings(),
  );
  const [savedGame, setSavedGame] = useState<SaveGameData | null>(() =>
    defaultPersistence.loadGame(),
  );

  // Support ?autostart=1 to boot directly into active 3D RTS world
  const isAutoStart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [screen, setScreen] = useState<GameShellScreen>(() =>
    isAutoStart ? 'playing' : 'title',
  );
  const [setupMode, setSetupMode] = useState<GameMode>('standard');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const [activeGame, setActiveGame] = useState<SaveGameData>(() => {
    const existing = defaultPersistence.loadGame();
    if (isAutoStart && existing) return existing;
    return createNewKingdomSave({
      kingdomId: 'oru',
      playerKingdomName: 'Kingdom of Oru',
      rulerName: 'Sovereign Amari',
      regionId: 'golden_savannah',
      gameMode: 'standard',
      settings: defaultPersistence.loadSettings(),
    });
  });

  const [selectedEntities, setSelectedEntities] = useState<SelectableEntity[]>([]);
  const [allEntities, setAllEntities] = useState<SelectableEntity[]>([]);
  const [placementPreview, setPlacementPreview] = useState<PlacementPreviewState>({
    active: false,
    archetype: null,
    x: 0,
    z: 0,
    rotationY: 0,
    valid: false,
  });
  const [touchCommandMode, setTouchCommandMode] = useState<TouchCommandMode>('select');
  const [notifications, setNotifications] = useState<EconomyNotification[]>([]);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Mirror Game Shell state onto document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  // Keep sound engine synced with settings
  useEffect(() => {
    soundEngine.updateSettings(settings.audio);
  }, [settings.audio]);

  const appendNotifications = useCallback((incoming: EconomyNotification[]) => {
    if (incoming.length === 0) return;
    setNotifications((prev) => [...prev.slice(-4), ...incoming]);
    for (const item of incoming) {
      window.setTimeout(() => {
        setNotifications((curr) => curr.filter((n) => n.id !== item.id));
      }, 5600);
    }
  }, []);

  // Mount Three.js AkanuEngine once inside isolated ref container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new AkanuEngine(container, {
      onSelectionChange: (entities) => {
        setSelectedEntities(entities);
      },
      onEconomySnapshot: (snap) => {
        setActiveGame((prev) => ({
          ...prev,
          resources: snap.resources,
          capacities: snap.capacities,
          rates: snap.rates,
          population: snap.population,
          progressionStage: snap.progressionStage,
          economyStats: snap.economyStats,
          elapsedPlaySeconds: snap.elapsedPlaySeconds,
          difficultyLevel: snap.difficultyLevel ?? prev.difficultyLevel,
        }));
        setAllEntities(snap.allEntities);
      },
      onNotifications: (incoming) => {
        appendNotifications(incoming);
      },
      onPlacementPreviewChange: (preview) => {
        setPlacementPreview(preview);
      },
      onTouchCommandModeChange: (mode) => {
        setTouchCommandMode(mode);
      },
    });
    engineRef.current = engine;

    engine.loadWorld({
      kingdomId: activeGame.kingdomId,
      regionId: activeGame.regionId,
      seed: activeGame.worldSeed,
      quality: settings.graphicsQuality,
      initialCamera: activeGame.cameraTarget,
      savedGame: activeGame,
    });
    engine.setPanSpeedMultiplier(settings.cameraPanSpeed);
    engine.setCameraTourMode(!isAutoStart);
    setAllEntities(engine.getAllSelectableEntities());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Intentionally mounted once so HUD state updates never recreate WebGL context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerToast = useCallback((msg: string) => {
    setSaveToast(msg);
    window.setTimeout(() => {
      setSaveToast((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  const handleOpenNewKingdom = useCallback(
    (mode: GameMode) => {
      soundEngine.playUiClick(1.05);
      setSetupMode(mode);
      setScreen('setup');
      if (engineRef.current) {
        engineRef.current.setCameraTourMode(true);
        engineRef.current.loadWorld({
          kingdomId: 'oru',
          regionId: 'golden_savannah',
          seed: 4819,
          quality: settings.graphicsQuality,
        });
      }
    },
    [settings.graphicsQuality],
  );

  const handlePreviewSetupChange = useCallback(
    (kingdomId: KingdomId, regionId: RegionId, seed: number) => {
      soundEngine.playUiClick(1.12);
      engineRef.current?.loadWorld({
        kingdomId,
        regionId,
        seed,
        quality: settings.graphicsQuality,
      });
    },
    [settings.graphicsQuality],
  );

  const handleConfirmFoundKingdom = useCallback(
    (params: {
      kingdomId: KingdomId;
      regionId: RegionId;
      playerKingdomName: string;
      rulerName: string;
      gameMode: GameMode;
      difficultyLevel: AIDifficulty;
      sandboxAbundantResources: boolean;
      worldSeed: number;
    }) => {
      const freshSave = createNewKingdomSave({
        kingdomId: params.kingdomId,
        playerKingdomName: params.playerKingdomName,
        rulerName: params.rulerName,
        regionId: params.regionId,
        gameMode: params.gameMode,
        difficultyLevel: params.difficultyLevel,
        sandboxAbundantResources: params.sandboxAbundantResources,
        worldSeed: params.worldSeed,
        settings,
      });

      defaultPersistence.saveGame(freshSave);
      setSavedGame(freshSave);
      setActiveGame(freshSave);
      setSelectedEntities([]);
      setNotifications([]);

      if (engineRef.current) {
        engineRef.current.setCameraTourMode(false);
        engineRef.current.setPaused(false);
        engineRef.current.loadWorld({
          kingdomId: freshSave.kingdomId,
          regionId: freshSave.regionId,
          seed: freshSave.worldSeed,
          quality: settings.graphicsQuality,
          initialCamera: freshSave.cameraTarget,
          savedGame: freshSave,
        });
        setAllEntities(engineRef.current.getAllSelectableEntities());
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      soundEngine.playKingdomFounded();
      setScreen('playing');
      triggerToast('Kingdom Charter Saved');
    },
    [settings, triggerToast],
  );

  const handleContinueSavedKingdom = useCallback(() => {
    const loaded = defaultPersistence.loadGame();
    if (!loaded) return;
    soundEngine.playKingdomFounded();
    setActiveGame(loaded);
    setSelectedEntities([]);
    setNotifications([]);

    if (engineRef.current) {
      engineRef.current.setCameraTourMode(false);
      engineRef.current.setPaused(false);
      engineRef.current.loadWorld({
        kingdomId: loaded.kingdomId,
        regionId: loaded.regionId,
        seed: loaded.worldSeed,
        quality: settings.graphicsQuality,
        initialCamera: loaded.cameraTarget,
        savedGame: loaded,
      });
      setAllEntities(engineRef.current.getAllSelectableEntities());
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setScreen('playing');
    triggerToast(`Restored ${loaded.playerKingdomName}`);
  }, [settings.graphicsQuality, triggerToast]);

  const handleSaveCurrentGame = useCallback(() => {
    soundEngine.playUiClick(1.15);
    const toSave: SaveGameData = engineRef.current
      ? engineRef.current.exportSaveSnapshot(activeGame, settings)
      : {
          ...activeGame,
          settings,
          savedAtIso: new Date().toISOString(),
        };
    const ok = defaultPersistence.saveGame(toSave);
    if (ok) {
      setActiveGame(toSave);
      setSavedGame(toSave);
      triggerToast('Kingdom Saved');
    }
  }, [activeGame, settings, triggerToast]);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    defaultPersistence.saveSettings(next);
    if (engineRef.current) {
      engineRef.current.setGraphicsQuality(next.graphicsQuality);
      engineRef.current.setPanSpeedMultiplier(next.cameraPanSpeed);
      setAllEntities(engineRef.current.getAllSelectableEntities());
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const next: GameSettings = {
      ...settings,
      audio: { ...settings.audio, muted: !settings.audio.muted },
    };
    handleUpdateSettings(next);
  }, [settings, handleUpdateSettings]);

  const handleChangeRegionLive = useCallback(
    (regionId: RegionId) => {
      soundEngine.playUiClick(1.08);
      const freshRegionSave = createNewKingdomSave({
        kingdomId: activeGame.kingdomId,
        playerKingdomName: activeGame.playerKingdomName,
        rulerName: activeGame.rulerName,
        regionId,
        gameMode: activeGame.gameMode,
        difficultyLevel: activeGame.difficultyLevel ?? 'normal',
        sandboxAbundantResources: activeGame.capacities.wood > 1100,
        worldSeed: activeGame.worldSeed,
        settings,
      });
      // Preserve player's current stockpiles clamped to capacities
      freshRegionSave.resources = { ...activeGame.resources };
      setActiveGame(freshRegionSave);
      defaultPersistence.saveGame(freshRegionSave);
      setSavedGame(freshRegionSave);

      if (engineRef.current) {
        engineRef.current.loadWorld({
          kingdomId: freshRegionSave.kingdomId,
          regionId,
          seed: freshRegionSave.worldSeed,
          quality: settings.graphicsQuality,
          savedGame: freshRegionSave,
        });
        setAllEntities(engineRef.current.getAllSelectableEntities());
      }
    },
    [activeGame, settings],
  );

  const handleChangeDifficulty = useCallback((difficulty: AIDifficulty) => {
    soundEngine.playUiClick(1.06);
    engineRef.current?.setAIDifficulty(difficulty);
    setActiveGame((prev) => ({ ...prev, difficultyLevel: difficulty }));
  }, []);

  // Global Game Shell Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (screen === 'title' && !settingsOpen && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleOpenNewKingdom('standard');
        return;
      }

      if (screen === 'playing' && !settingsOpen) {
        if (e.code === 'Escape') {
          if (placementPreview.active) {
            engineRef.current?.startBuildingPlacement(null);
          } else if (touchCommandMode !== 'select') {
            engineRef.current?.setTouchCommandMode('select');
          } else if (selectedEntities.length > 0) {
            engineRef.current?.clearSelection();
          } else {
            engineRef.current?.setPaused(true);
            setScreen('paused');
          }
        } else if (e.code === 'KeyP') {
          engineRef.current?.setPaused(true);
          setScreen('paused');
        } else if (e.code === 'KeyM') {
          handleToggleMute();
        } else if (e.code === 'KeyF' && selectedEntities.length > 0) {
          engineRef.current?.focusOnEntity(selectedEntities[0].id);
        } else if (e.code === 'Home') {
          engineRef.current?.focusSettlementCenter();
        }
      } else if (
        screen === 'paused' &&
        !settingsOpen &&
        (e.code === 'Escape' || e.code === 'KeyP')
      ) {
        engineRef.current?.setPaused(false);
        setScreen('playing');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    settingsOpen,
    placementPreview.active,
    touchCommandMode,
    selectedEntities,
    handleOpenNewKingdom,
    handleToggleMute,
  ]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#171512]">
      {/* Isolated Full-Viewport 3D WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full z-0"
        aria-label="Empires of Akanu 3D World Viewport"
      />

      {/* Screen 1: Main Strategy Menu over Live 3D World Camera Tour */}
      {screen === 'title' && (
        <MainMenu
          savedGame={savedGame}
          onNewKingdom={() => handleOpenNewKingdom('standard')}
          onContinueGame={handleContinueSavedKingdom}
          onKingdomSandbox={() => handleOpenNewKingdom('sandbox')}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setSettingsOpen(true);
          }}
        />
      )}

      {/* Screen 2: Founding Kingdom & Geographical Region Selection */}
      {screen === 'setup' && (
        <KingdomSelectionModal
          mode={setupMode}
          initialKingdomId={activeGame.kingdomId}
          initialRegionId="golden_savannah"
          onPreviewChange={handlePreviewSetupChange}
          onConfirmStart={handleConfirmFoundKingdom}
          onCancel={() => {
            soundEngine.playUiClick(0.92);
            setScreen('title');
          }}
        />
      )}

      {/* Screen 3: Active 3D RTS World & Low-Occlusion HUD */}
      {(screen === 'playing' || screen === 'paused') && (
        <GameHUD
          gameData={activeGame}
          selectedEntities={selectedEntities}
          allEntities={allEntities}
          placementPreview={placementPreview}
          touchCommandMode={touchCommandMode}
          notifications={notifications}
          audioMuted={settings.audio.muted}
          saveToast={saveToast}
          onSelectEntityById={(id, additive) =>
            engineRef.current?.selectEntityById(id, additive)
          }
          onSelectVillagersByRole={(filter) => {
            soundEngine.playUiClick(1.06);
            engineRef.current?.selectVillagersByFilter(filter);
          }}
          onFocusEntity={(id) => {
            soundEngine.playUiClick(1.06);
            engineRef.current?.focusOnEntity(id);
          }}
          onFocusSettlement={() => {
            soundEngine.playUiClick(1.0);
            engineRef.current?.focusSettlementCenter();
          }}
          onCameraZoom={(delta) => engineRef.current?.zoomStep(delta)}
          onCameraRotate={(deltaYaw) => engineRef.current?.rotateStep(deltaYaw)}
          onCameraPreset={(preset) => {
            soundEngine.playUiClick(1.04);
            engineRef.current?.setCameraPreset(preset);
          }}
          onAssignOccupation={(role, pref) => {
            soundEngine.playUiClick(1.1);
            engineRef.current?.assignSelectedVillagersOccupation(role, pref);
          }}
          onAdjustWorkforce={(role, delta) => {
            soundEngine.playUiClick(1.08);
            engineRef.current?.adjustWorkforceAllocation(role, delta);
          }}
          onCancelVillagerTask={() => {
            soundEngine.playUiClick(0.92);
            engineRef.current?.cancelSelectedVillagersTask();
          }}
          onSetTouchCommandMode={(mode) => {
            soundEngine.playUiClick(1.04);
            engineRef.current?.setTouchCommandMode(mode);
          }}
          onDispatchWorkerToEntity={(targetId) => {
            soundEngine.playUiClick(1.1);
            engineRef.current?.dispatchWorkerToEntity(targetId);
          }}
          onStartBuildingPlacement={(arch) => {
            soundEngine.playUiClick(1.08);
            engineRef.current?.startBuildingPlacement(arch);
          }}
          onRotatePlacementPreview={() => {
            soundEngine.playUiClick(1.04);
            engineRef.current?.rotatePlacementPreview();
          }}
          onConfirmPlacement={() => {
            const placed = engineRef.current?.confirmPlacementAtCurrentPreview();
            if (placed) {
              soundEngine.playKingdomFounded();
            }
          }}
          onCancelConstruction={(bldId) => {
            soundEngine.playUiClick(0.9);
            engineRef.current?.cancelBuildingConstruction(bldId);
          }}
          onSelectMilitaryUnits={(filter) => {
            soundEngine.playUiClick(1.06);
            engineRef.current?.selectMilitaryUnits(filter);
          }}
          onRecruitUnit={(buildingId, unitClass) => {
            soundEngine.playUiClick(1.12);
            engineRef.current?.recruitUnitAtBuilding(buildingId, unitClass);
          }}
          onCancelRecruitment={(buildingId, index) => {
            soundEngine.playUiClick(0.9);
            engineRef.current?.cancelRecruitment(buildingId, index);
          }}
          onSetFormation={(formation) => {
            soundEngine.playUiClick(1.05);
            engineRef.current?.setFormationForSelectedMilitary(formation);
          }}
          onSetStance={(stance) => {
            soundEngine.playUiClick(1.05);
            engineRef.current?.setStanceForSelectedMilitary(stance);
          }}
          onMilitaryAttack={() => {
            soundEngine.playUiClick(1.15);
            engineRef.current?.setTouchCommandMode('attack');
          }}
          onDismissNotification={(id) =>
            setNotifications((prev) => prev.filter((n) => n.id !== id))
          }
          onSaveGame={handleSaveCurrentGame}
          onToggleMute={handleToggleMute}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setSettingsOpen(true);
          }}
          onOpenPause={() => {
            soundEngine.playUiClick(0.95);
            engineRef.current?.setPaused(true);
            setScreen('paused');
          }}
          onChangeRegionLive={handleChangeRegionLive}
          aiKingdomsData={engineRef.current?.getAIKingdomsData()}
          diplomacyRelations={engineRef.current?.getDiplomacyRelations()}
          worldEventsData={engineRef.current?.getWorldEvents()}
          onProposeTreaty={(targetId, kind) =>
            engineRef.current?.proposeDiplomaticTreaty(targetId, kind) || {
              accepted: false,
              reason: 'Engine offline',
            }
          }
          onSendEnvoy={(targetId) =>
            engineRef.current?.dispatchDiplomaticEnvoy(targetId, 100) || {
              ok: false,
              reason: 'Engine offline',
            }
          }
          onProposePeace={(targetId) =>
            engineRef.current?.proposePeace(targetId) || {
              accepted: false,
              reason: 'Engine offline',
            }
          }
          onDeclareWar={(targetId) => engineRef.current?.declareWar(targetId)}
        />
      )}

      {/* Screen 4: Pause & Save Council Modal */}
      {screen === 'paused' && !settingsOpen && (
        <PauseModal
          activeSave={activeGame}
          saveStatusMessage={saveToast}
          onChangeDifficulty={handleChangeDifficulty}
          onResume={() => {
            soundEngine.playUiClick(1.05);
            engineRef.current?.setPaused(false);
            setScreen('playing');
          }}
          onSaveKingdom={handleSaveCurrentGame}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setSettingsOpen(true);
          }}
          onReturnToTitle={() => {
            handleSaveCurrentGame();
            if (engineRef.current) {
              engineRef.current.setPaused(false);
              engineRef.current.setCameraTourMode(true);
              engineRef.current.clearSelection();
            }
            setScreen('title');
          }}
        />
      )}

      {/* Global Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          isSoftwareGl={engineRef.current?.isSoftwareGl}
          onChangeSettings={handleUpdateSettings}
          onClose={() => {
            soundEngine.playUiClick(1.05);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
