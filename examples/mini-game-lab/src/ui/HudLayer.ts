import { Game } from '../core/Game';

export class HudLayer {
  private container: HTMLDivElement;
  private topBar: HTMLDivElement;
  private actionBar: HTMLDivElement;
  private cashText: HTMLDivElement;
  private hudToggleBtn: HTMLButtonElement;
  private spectatorToggleBtn: HTMLButtonElement;
  private collisionToggleBtn: HTMLButtonElement;
  private spawnCashBtn: HTMLButtonElement;
  private sawmillToggleBtn: HTMLButtonElement;
  private conveyorGroundDecalsBtn: HTMLButtonElement;
  private conveyorArrowPauseBtn: HTMLButtonElement;
  private unlockStageBtn: HTMLButtonElement;
  private hideVehiclesBtn: HTMLButtonElement;
  private hideLv3LoggingTruckBtn: HTMLButtonElement;
  private hideUnlockDoorDecalBase2Btn: HTMLButtonElement;
  private revealAllBtn: HTMLButtonElement;
  private shadowPanel: HTMLDivElement;
  private shadowEnabledInput: HTMLInputElement;
  private shadowAlphaInput: HTMLInputElement;
  private shadowSizeInput: HTMLInputElement;
  private shadowBiasInput: HTMLInputElement;
  private shadowGroundInput: HTMLInputElement;
  private shadowSaveBtn: HTMLButtonElement;
  private shadowValueText: HTMLDivElement;
  private truckShadowPanel: HTMLDivElement;
  private truckShadowEnabledInput: HTMLInputElement;
  private truckShadowAlphaInput: HTMLInputElement;
  private truckShadowSizeInput: HTMLInputElement;
  private truckShadowBiasInput: HTMLInputElement;
  private truckShadowGroundInput: HTMLInputElement;
  private truckShadowSaveBtn: HTMLButtonElement;
  private truckShadowValueText: HTMLDivElement;
  private giantLogShadowPanel: HTMLDivElement;
  private giantLogShadowEnabledInput: HTMLInputElement;
  private giantLogShadowAlphaInput: HTMLInputElement;
  private giantLogShadowSizeInput: HTMLInputElement;
  private giantLogShadowBiasInput: HTMLInputElement;
  private giantLogShadowGroundInput: HTMLInputElement;
  private giantLogShadowSaveBtn: HTMLButtonElement;
  private giantLogShadowValueText: HTMLDivElement;
  private game: Game | null = null;
  private debugHudVisible = true;
  private spawnCashResetTimer: number | null = null;
  private revealAllResetTimer: number | null = null;

  private shadowPanelsVisible = false;
  private toggleShadowPanelsBtn: HTMLButtonElement;
  private visible = true;

  constructor() {
    this.container = document.createElement('div');
    this.container.dataset.inputLayer = 'ui';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'space-between';
    this.container.style.padding = '20px';
    this.container.style.boxSizing = 'border-box';
    this.container.style.fontFamily = 'sans-serif';
    this.container.style.zIndex = '10';

    this.topBar = document.createElement('div');
    this.topBar.style.display = 'flex';
    this.topBar.style.justifyContent = 'flex-end';
    this.topBar.style.width = '100%';

    const inventoryPanel = document.createElement('div');
    inventoryPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    inventoryPanel.style.color = '#fff';
    inventoryPanel.style.padding = '12px 20px';
    inventoryPanel.style.borderRadius = '8px';
    inventoryPanel.style.fontSize = '18px';
    inventoryPanel.style.fontWeight = 'bold';
    inventoryPanel.style.textAlign = 'right';

    this.cashText = document.createElement('div');
    this.cashText.style.color = '#3bc56f';
    inventoryPanel.appendChild(this.cashText);

    this.topBar.appendChild(inventoryPanel);
    this.container.appendChild(this.topBar);

    this.actionBar = document.createElement('div');
    this.actionBar.style.display = 'flex';
    this.actionBar.style.justifyContent = 'flex-end';
    this.actionBar.style.gap = '10px';
    this.actionBar.style.flexWrap = 'wrap';
    this.actionBar.style.width = '100%';
    this.actionBar.style.marginTop = '10px';

    this.hudToggleBtn = document.createElement('button');
    this.hudToggleBtn.type = 'button';
    this.hudToggleBtn.style.position = 'absolute';
    this.hudToggleBtn.style.bottom = '20px';
    this.hudToggleBtn.style.right = '20px';
    this.hudToggleBtn.style.pointerEvents = 'auto';
    this.hudToggleBtn.style.border = '0';
    this.hudToggleBtn.style.borderRadius = '8px';
    this.hudToggleBtn.style.padding = '10px 14px';
    this.hudToggleBtn.style.fontSize = '14px';
    this.hudToggleBtn.style.fontWeight = '700';
    this.hudToggleBtn.style.cursor = 'pointer';
    this.hudToggleBtn.style.zIndex = '11';
    this.hudToggleBtn.onclick = () => this.toggleDebugHud();
    this.hudToggleBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.hudToggleBtn.onpointerup = (ev) => ev.stopPropagation();
    this.hudToggleBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.container.appendChild(this.hudToggleBtn);

    this.spectatorToggleBtn = document.createElement('button');
    this.spectatorToggleBtn.type = 'button';
    this.spectatorToggleBtn.style.pointerEvents = 'auto';
    this.spectatorToggleBtn.style.border = '0';
    this.spectatorToggleBtn.style.borderRadius = '8px';
    this.spectatorToggleBtn.style.padding = '10px 14px';
    this.spectatorToggleBtn.style.fontSize = '14px';
    this.spectatorToggleBtn.style.fontWeight = '700';
    this.spectatorToggleBtn.style.cursor = 'pointer';
    this.spectatorToggleBtn.onclick = () => this.toggleSpectatorMode();
    this.spectatorToggleBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.spectatorToggleBtn.onpointerup = (ev) => ev.stopPropagation();
    this.spectatorToggleBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.spectatorToggleBtn);

    this.collisionToggleBtn = document.createElement('button');
    this.collisionToggleBtn.type = 'button';
    this.collisionToggleBtn.style.pointerEvents = 'auto';
    this.collisionToggleBtn.style.border = '0';
    this.collisionToggleBtn.style.borderRadius = '8px';
    this.collisionToggleBtn.style.padding = '10px 14px';
    this.collisionToggleBtn.style.fontSize = '14px';
    this.collisionToggleBtn.style.fontWeight = '700';
    this.collisionToggleBtn.style.cursor = 'pointer';
    this.collisionToggleBtn.onclick = () => this.toggleCollision();
    this.collisionToggleBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.collisionToggleBtn.onpointerup = (ev) => ev.stopPropagation();
    this.collisionToggleBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.collisionToggleBtn);

    this.spawnCashBtn = document.createElement('button');
    this.spawnCashBtn.type = 'button';
    this.spawnCashBtn.style.pointerEvents = 'auto';
    this.spawnCashBtn.style.border = '0';
    this.spawnCashBtn.style.borderRadius = '8px';
    this.spawnCashBtn.style.padding = '10px 14px';
    this.spawnCashBtn.style.fontSize = '14px';
    this.spawnCashBtn.style.fontWeight = '700';
    this.spawnCashBtn.style.cursor = 'pointer';
    this.spawnCashBtn.style.backgroundColor = 'rgba(59, 197, 111, 0.92)';
    this.spawnCashBtn.style.color = '#ffffff';
    this.spawnCashBtn.innerText = '生成50美钞';
    this.spawnCashBtn.onclick = () => this.spawnCashStack();
    this.spawnCashBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.spawnCashBtn.onpointerup = (ev) => ev.stopPropagation();
    this.spawnCashBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.spawnCashBtn);

    this.sawmillToggleBtn = document.createElement('button');
    this.sawmillToggleBtn.type = 'button';
    this.sawmillToggleBtn.style.pointerEvents = 'auto';
    this.sawmillToggleBtn.style.border = '0';
    this.sawmillToggleBtn.style.borderRadius = '8px';
    this.sawmillToggleBtn.style.padding = '10px 14px';
    this.sawmillToggleBtn.style.fontSize = '14px';
    this.sawmillToggleBtn.style.fontWeight = '700';
    this.sawmillToggleBtn.style.cursor = 'pointer';
    this.sawmillToggleBtn.onclick = () => this.toggleSawmill();
    this.sawmillToggleBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.sawmillToggleBtn.onpointerup = (ev) => ev.stopPropagation();
    this.sawmillToggleBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.sawmillToggleBtn);

    this.conveyorGroundDecalsBtn = document.createElement('button');
    this.conveyorGroundDecalsBtn.type = 'button';
    this.conveyorGroundDecalsBtn.style.pointerEvents = 'auto';
    this.conveyorGroundDecalsBtn.style.border = '0';
    this.conveyorGroundDecalsBtn.style.borderRadius = '8px';
    this.conveyorGroundDecalsBtn.style.padding = '10px 14px';
    this.conveyorGroundDecalsBtn.style.fontSize = '14px';
    this.conveyorGroundDecalsBtn.style.fontWeight = '700';
    this.conveyorGroundDecalsBtn.style.cursor = 'pointer';
    this.conveyorGroundDecalsBtn.onclick = () => this.toggleConveyorGroundDecals();
    this.conveyorGroundDecalsBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.conveyorGroundDecalsBtn.onpointerup = (ev) => ev.stopPropagation();
    this.conveyorGroundDecalsBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.conveyorGroundDecalsBtn);

    this.conveyorArrowPauseBtn = document.createElement('button');
    this.conveyorArrowPauseBtn.type = 'button';
    this.conveyorArrowPauseBtn.style.pointerEvents = 'auto';
    this.conveyorArrowPauseBtn.style.border = '0';
    this.conveyorArrowPauseBtn.style.borderRadius = '8px';
    this.conveyorArrowPauseBtn.style.padding = '10px 14px';
    this.conveyorArrowPauseBtn.style.fontSize = '14px';
    this.conveyorArrowPauseBtn.style.fontWeight = '700';
    this.conveyorArrowPauseBtn.style.cursor = 'pointer';
    this.conveyorArrowPauseBtn.onclick = () => this.toggleConveyorArrowMovement();
    this.conveyorArrowPauseBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.conveyorArrowPauseBtn.onpointerup = (ev) => ev.stopPropagation();
    this.conveyorArrowPauseBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.conveyorArrowPauseBtn);

    this.unlockStageBtn = document.createElement('button');
    this.unlockStageBtn.type = 'button';
    this.unlockStageBtn.style.pointerEvents = 'auto';
    this.unlockStageBtn.style.border = '0';
    this.unlockStageBtn.style.borderRadius = '8px';
    this.unlockStageBtn.style.padding = '10px 14px';
    this.unlockStageBtn.style.fontSize = '14px';
    this.unlockStageBtn.style.fontWeight = '700';
    this.unlockStageBtn.style.cursor = 'pointer';
    this.unlockStageBtn.style.backgroundColor = 'rgba(122, 215, 255, 0.92)';
    this.unlockStageBtn.style.color = '#062433';
    this.unlockStageBtn.innerText = '跳到解锁阶段';
    this.unlockStageBtn.onclick = () => this.advanceToUnlockedConveyorStage();
    this.unlockStageBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.unlockStageBtn.onpointerup = (ev) => ev.stopPropagation();
    this.unlockStageBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.unlockStageBtn);

    this.hideVehiclesBtn = document.createElement('button');
    this.hideVehiclesBtn.type = 'button';
    this.hideVehiclesBtn.style.pointerEvents = 'auto';
    this.hideVehiclesBtn.style.border = '0';
    this.hideVehiclesBtn.style.borderRadius = '8px';
    this.hideVehiclesBtn.style.padding = '10px 14px';
    this.hideVehiclesBtn.style.fontSize = '14px';
    this.hideVehiclesBtn.style.fontWeight = '700';
    this.hideVehiclesBtn.style.cursor = 'pointer';
    this.hideVehiclesBtn.style.backgroundColor = 'rgba(230, 91, 91, 0.92)';
    this.hideVehiclesBtn.style.color = '#ffffff';
    this.hideVehiclesBtn.innerText = '隐藏车辆';
    this.hideVehiclesBtn.onclick = () => this.hideVehicles();
    this.hideVehiclesBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.hideVehiclesBtn.onpointerup = (ev) => ev.stopPropagation();
    this.hideVehiclesBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.hideVehiclesBtn);

    this.hideLv3LoggingTruckBtn = document.createElement('button');
    this.hideLv3LoggingTruckBtn.type = 'button';
    this.hideLv3LoggingTruckBtn.style.pointerEvents = 'auto';
    this.hideLv3LoggingTruckBtn.style.border = '0';
    this.hideLv3LoggingTruckBtn.style.borderRadius = '8px';
    this.hideLv3LoggingTruckBtn.style.padding = '10px 14px';
    this.hideLv3LoggingTruckBtn.style.fontSize = '14px';
    this.hideLv3LoggingTruckBtn.style.fontWeight = '700';
    this.hideLv3LoggingTruckBtn.style.cursor = 'pointer';
    this.hideLv3LoggingTruckBtn.style.backgroundColor = 'rgba(230, 91, 91, 0.92)';
    this.hideLv3LoggingTruckBtn.style.color = '#ffffff';
    this.hideLv3LoggingTruckBtn.innerText = '隐藏三级伐木车';
    this.hideLv3LoggingTruckBtn.onclick = () => this.hideLv3LoggingTruck();
    this.hideLv3LoggingTruckBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.hideLv3LoggingTruckBtn.onpointerup = (ev) => ev.stopPropagation();
    this.hideLv3LoggingTruckBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.hideLv3LoggingTruckBtn);

    this.hideUnlockDoorDecalBase2Btn = document.createElement('button');
    this.hideUnlockDoorDecalBase2Btn.type = 'button';
    this.hideUnlockDoorDecalBase2Btn.style.pointerEvents = 'auto';
    this.hideUnlockDoorDecalBase2Btn.style.border = '0';
    this.hideUnlockDoorDecalBase2Btn.style.borderRadius = '8px';
    this.hideUnlockDoorDecalBase2Btn.style.padding = '10px 14px';
    this.hideUnlockDoorDecalBase2Btn.style.fontSize = '14px';
    this.hideUnlockDoorDecalBase2Btn.style.fontWeight = '700';
    this.hideUnlockDoorDecalBase2Btn.style.cursor = 'pointer';
    this.hideUnlockDoorDecalBase2Btn.style.backgroundColor = 'rgba(230, 91, 91, 0.92)';
    this.hideUnlockDoorDecalBase2Btn.style.color = '#ffffff';
    this.hideUnlockDoorDecalBase2Btn.innerText = '隐藏灰底2';
    this.hideUnlockDoorDecalBase2Btn.onclick = () => this.hideUnlockDoorDecalBase2();
    this.hideUnlockDoorDecalBase2Btn.onpointerdown = (ev) => ev.stopPropagation();
    this.hideUnlockDoorDecalBase2Btn.onpointerup = (ev) => ev.stopPropagation();
    this.hideUnlockDoorDecalBase2Btn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.hideUnlockDoorDecalBase2Btn);

    this.revealAllBtn = document.createElement('button');
    this.revealAllBtn.type = 'button';
    this.revealAllBtn.style.pointerEvents = 'auto';
    this.revealAllBtn.style.border = '0';
    this.revealAllBtn.style.borderRadius = '8px';
    this.revealAllBtn.style.padding = '10px 14px';
    this.revealAllBtn.style.fontSize = '14px';
    this.revealAllBtn.style.fontWeight = '700';
    this.revealAllBtn.style.cursor = 'pointer';
    this.revealAllBtn.style.backgroundColor = 'rgba(59, 197, 111, 0.92)';
    this.revealAllBtn.style.color = '#ffffff';
    this.revealAllBtn.innerText = '显示所有物体';
    this.revealAllBtn.onclick = () => this.revealAllObjects();
    this.revealAllBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.revealAllBtn.onpointerup = (ev) => ev.stopPropagation();
    this.revealAllBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.actionBar.appendChild(this.revealAllBtn);

    this.toggleShadowPanelsBtn = document.createElement('button');
    this.toggleShadowPanelsBtn.type = 'button';
    this.toggleShadowPanelsBtn.style.position = 'absolute';
    this.toggleShadowPanelsBtn.style.bottom = '20px';
    this.toggleShadowPanelsBtn.style.left = '20px';
    this.toggleShadowPanelsBtn.style.pointerEvents = 'auto';
    this.toggleShadowPanelsBtn.style.border = '0';
    this.toggleShadowPanelsBtn.style.borderRadius = '8px';
    this.toggleShadowPanelsBtn.style.padding = '10px 14px';
    this.toggleShadowPanelsBtn.style.fontSize = '14px';
    this.toggleShadowPanelsBtn.style.fontWeight = '700';
    this.toggleShadowPanelsBtn.style.cursor = 'pointer';
    this.toggleShadowPanelsBtn.style.zIndex = '11';
    this.toggleShadowPanelsBtn.onclick = () => this.toggleShadowPanels();
    this.toggleShadowPanelsBtn.onpointerdown = (ev) => ev.stopPropagation();
    this.toggleShadowPanelsBtn.onpointerup = (ev) => ev.stopPropagation();
    this.toggleShadowPanelsBtn.ontouchstart = (ev) => ev.stopPropagation();
    this.container.appendChild(this.toggleShadowPanelsBtn);

    this.container.appendChild(this.actionBar);

    this.shadowPanel = document.createElement('div');
    this.shadowPanel.style.position = 'absolute';
    this.shadowPanel.style.left = '20px';
    this.shadowPanel.style.bottom = '70px';
    this.shadowPanel.style.width = '280px';
    this.shadowPanel.style.pointerEvents = 'auto';
    this.shadowPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.68)';
    this.shadowPanel.style.color = '#fff';
    this.shadowPanel.style.borderRadius = '10px';
    this.shadowPanel.style.padding = '12px 14px';
    this.shadowPanel.style.fontSize = '12px';
    this.shadowPanel.style.fontWeight = '700';
    this.shadowPanel.style.boxSizing = 'border-box';
    this.shadowPanel.onpointerdown = (ev) => ev.stopPropagation();
    this.shadowPanel.onpointerup = (ev) => ev.stopPropagation();
    this.shadowPanel.ontouchstart = (ev) => ev.stopPropagation();

    const shadowTitle = document.createElement('div');
    shadowTitle.innerText = '树林平面阴影';
    shadowTitle.style.marginBottom = '8px';
    shadowTitle.style.color = '#7ad7ff';
    this.shadowPanel.appendChild(shadowTitle);

    this.shadowEnabledInput = document.createElement('input');
    this.shadowEnabledInput.type = 'checkbox';
    this.shadowEnabledInput.onchange = () => this.applyShadowHudSettings();
    this.shadowPanel.appendChild(this.createShadowCheckboxRow('启用', this.shadowEnabledInput));

    this.shadowAlphaInput = this.createShadowRangeInput(0, 0.8, 0.01);
    this.shadowSizeInput = this.createShadowRangeInput(0.35, 1, 0.01);
    this.shadowBiasInput = this.createShadowRangeInput(0, 0.12, 0.005);
    this.shadowGroundInput = this.createShadowRangeInput(-0.2, 0.2, 0.005);
    this.shadowPanel.appendChild(this.createShadowSliderRow('Alpha', this.shadowAlphaInput));
    this.shadowPanel.appendChild(this.createShadowSliderRow('Size', this.shadowSizeInput));
    this.shadowPanel.appendChild(this.createShadowSliderRow('Bias', this.shadowBiasInput));
    this.shadowPanel.appendChild(this.createShadowSliderRow('Ground Y', this.shadowGroundInput));

    this.shadowSaveBtn = this.createShadowSaveButton('保存树林阴影');
    this.shadowSaveBtn.onclick = () => this.saveShadowHudSettings('forest');
    this.shadowPanel.appendChild(this.shadowSaveBtn);

    this.shadowValueText = document.createElement('div');
    this.shadowValueText.style.marginTop = '8px';
    this.shadowValueText.style.color = '#ffd800';
    this.shadowValueText.style.fontSize = '11px';
    this.shadowPanel.appendChild(this.shadowValueText);
    this.container.appendChild(this.shadowPanel);

    this.truckShadowPanel = document.createElement('div');
    this.truckShadowPanel.style.position = 'absolute';
    this.truckShadowPanel.style.left = '320px';
    this.truckShadowPanel.style.bottom = '70px';
    this.truckShadowPanel.style.width = '280px';
    this.truckShadowPanel.style.pointerEvents = 'auto';
    this.truckShadowPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.68)';
    this.truckShadowPanel.style.color = '#fff';
    this.truckShadowPanel.style.borderRadius = '10px';
    this.truckShadowPanel.style.padding = '12px 14px';
    this.truckShadowPanel.style.fontSize = '12px';
    this.truckShadowPanel.style.fontWeight = '700';
    this.truckShadowPanel.style.boxSizing = 'border-box';
    this.truckShadowPanel.onpointerdown = (ev) => ev.stopPropagation();
    this.truckShadowPanel.onpointerup = (ev) => ev.stopPropagation();
    this.truckShadowPanel.ontouchstart = (ev) => ev.stopPropagation();

    const truckShadowTitle = document.createElement('div');
    truckShadowTitle.innerText = '车辆平面阴影';
    truckShadowTitle.style.marginBottom = '8px';
    truckShadowTitle.style.color = '#ffbd7a';
    this.truckShadowPanel.appendChild(truckShadowTitle);

    this.truckShadowEnabledInput = document.createElement('input');
    this.truckShadowEnabledInput.type = 'checkbox';
    this.truckShadowEnabledInput.onchange = () => this.applyTruckShadowHudSettings();
    this.truckShadowPanel.appendChild(this.createShadowCheckboxRow('启用', this.truckShadowEnabledInput));

    this.truckShadowAlphaInput = this.createShadowRangeInput(0, 0.8, 0.01);
    this.truckShadowSizeInput = this.createShadowRangeInput(0.35, 1, 0.01);
    this.truckShadowBiasInput = this.createShadowRangeInput(0, 0.12, 0.005);
    this.truckShadowGroundInput = this.createShadowRangeInput(-0.2, 0.2, 0.005);
    this.truckShadowAlphaInput.oninput = () => this.applyTruckShadowHudSettings();
    this.truckShadowSizeInput.oninput = () => this.applyTruckShadowHudSettings();
    this.truckShadowBiasInput.oninput = () => this.applyTruckShadowHudSettings();
    this.truckShadowGroundInput.oninput = () => this.applyTruckShadowHudSettings();
    this.truckShadowPanel.appendChild(this.createShadowSliderRow('Alpha', this.truckShadowAlphaInput));
    this.truckShadowPanel.appendChild(this.createShadowSliderRow('Size', this.truckShadowSizeInput));
    this.truckShadowPanel.appendChild(this.createShadowSliderRow('Bias', this.truckShadowBiasInput));
    this.truckShadowPanel.appendChild(this.createShadowSliderRow('Ground Y', this.truckShadowGroundInput));

    this.truckShadowSaveBtn = this.createShadowSaveButton('保存车辆阴影');
    this.truckShadowSaveBtn.onclick = () => this.saveShadowHudSettings('trucks');
    this.truckShadowPanel.appendChild(this.truckShadowSaveBtn);

    this.truckShadowValueText = document.createElement('div');
    this.truckShadowValueText.style.marginTop = '8px';
    this.truckShadowValueText.style.color = '#ffd800';
    this.truckShadowValueText.style.fontSize = '11px';
    this.truckShadowPanel.appendChild(this.truckShadowValueText);
    this.container.appendChild(this.truckShadowPanel);

    this.giantLogShadowPanel = document.createElement('div');
    this.giantLogShadowPanel.style.position = 'absolute';
    this.giantLogShadowPanel.style.left = '620px';
    this.giantLogShadowPanel.style.bottom = '70px';
    this.giantLogShadowPanel.style.width = '280px';
    this.giantLogShadowPanel.style.pointerEvents = 'auto';
    this.giantLogShadowPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.68)';
    this.giantLogShadowPanel.style.color = '#fff';
    this.giantLogShadowPanel.style.borderRadius = '10px';
    this.giantLogShadowPanel.style.padding = '12px 14px';
    this.giantLogShadowPanel.style.fontSize = '12px';
    this.giantLogShadowPanel.style.fontWeight = '700';
    this.giantLogShadowPanel.style.boxSizing = 'border-box';
    this.giantLogShadowPanel.onpointerdown = (ev) => ev.stopPropagation();
    this.giantLogShadowPanel.onpointerup = (ev) => ev.stopPropagation();
    this.giantLogShadowPanel.ontouchstart = (ev) => ev.stopPropagation();

    const giantLogShadowTitle = document.createElement('div');
    giantLogShadowTitle.innerText = '巨木平面阴影';
    giantLogShadowTitle.style.marginBottom = '8px';
    giantLogShadowTitle.style.color = '#9bff7a';
    this.giantLogShadowPanel.appendChild(giantLogShadowTitle);

    this.giantLogShadowEnabledInput = document.createElement('input');
    this.giantLogShadowEnabledInput.type = 'checkbox';
    this.giantLogShadowEnabledInput.onchange = () => this.applyGiantLogShadowHudSettings();
    this.giantLogShadowPanel.appendChild(this.createShadowCheckboxRow('启用', this.giantLogShadowEnabledInput));

    this.giantLogShadowAlphaInput = this.createShadowRangeInput(0, 0.8, 0.01);
    this.giantLogShadowSizeInput = this.createShadowRangeInput(0.35, 1, 0.01);
    this.giantLogShadowBiasInput = this.createShadowRangeInput(0, 0.12, 0.005);
    this.giantLogShadowGroundInput = this.createShadowRangeInput(-0.2, 0.2, 0.005);
    this.giantLogShadowAlphaInput.oninput = () => this.applyGiantLogShadowHudSettings();
    this.giantLogShadowSizeInput.oninput = () => this.applyGiantLogShadowHudSettings();
    this.giantLogShadowBiasInput.oninput = () => this.applyGiantLogShadowHudSettings();
    this.giantLogShadowGroundInput.oninput = () => this.applyGiantLogShadowHudSettings();
    this.giantLogShadowPanel.appendChild(this.createShadowSliderRow('Alpha', this.giantLogShadowAlphaInput));
    this.giantLogShadowPanel.appendChild(this.createShadowSliderRow('Size', this.giantLogShadowSizeInput));
    this.giantLogShadowPanel.appendChild(this.createShadowSliderRow('Bias', this.giantLogShadowBiasInput));
    this.giantLogShadowPanel.appendChild(this.createShadowSliderRow('Ground Y', this.giantLogShadowGroundInput));

    this.giantLogShadowSaveBtn = this.createShadowSaveButton('保存巨木阴影');
    this.giantLogShadowSaveBtn.onclick = () => this.saveShadowHudSettings('giant_logs');
    this.giantLogShadowPanel.appendChild(this.giantLogShadowSaveBtn);

    this.giantLogShadowValueText = document.createElement('div');
    this.giantLogShadowValueText.style.marginTop = '8px';
    this.giantLogShadowValueText.style.color = '#ffd800';
    this.giantLogShadowValueText.style.fontSize = '11px';
    this.giantLogShadowPanel.appendChild(this.giantLogShadowValueText);
    this.container.appendChild(this.giantLogShadowPanel);

    this.refreshDebugHudVisibility();
    document.body.appendChild(this.container);
  }

  attach(game: Game): void {
    this.game = game;
    this.refreshCollisionButton();
    this.refreshSpectatorButton();
    this.refreshSawmillButton();
    this.refreshConveyorArrowPauseButton();
    this.refreshVisibilityButtons();
    this.refreshToggleShadowPanelsButton();
    this.refreshShadowHudValues();
    this.refreshTruckShadowHudValues();
    this.refreshGiantLogShadowHudValues();
    this.applySavedShadowHudSettings();
  }

  update(): void {
    if (!this.game || !this.visible) return;

    const player = this.game.getPlayer();
    const economy = (this.game as any).economySystem;
    const guide = (this.game as any).newbieGuideSystem;

    if (player) {
    }

    if (economy) {
      this.cashText.innerText = `Cash: $${economy.cash}`;
    }

    void guide;

    this.refreshCollisionButton();
    this.refreshSpectatorButton();
    this.refreshSawmillButton();
    this.refreshConveyorGroundDecalsButton();
    this.refreshConveyorArrowPauseButton();
    this.refreshVisibilityButtons();
    this.refreshToggleShadowPanelsButton();
    this.refreshShadowHudLabel();
    this.refreshTruckShadowHudLabel();
    this.refreshGiantLogShadowHudLabel();
    this.refreshDebugHudVisibility();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'flex' : 'none';
  }

  private toggleDebugHud(): void {
    this.debugHudVisible = !this.debugHudVisible;
    this.refreshDebugHudVisibility();
  }

  private refreshDebugHudVisibility(): void {
    this.topBar.style.display = this.debugHudVisible ? 'flex' : 'none';
    this.actionBar.style.display = this.debugHudVisible ? 'flex' : 'none';
    this.toggleShadowPanelsBtn.style.display = 'block';

    const shadowDisplay = (this.debugHudVisible && this.shadowPanelsVisible) ? 'block' : 'none';
    this.shadowPanel.style.display = shadowDisplay;
    this.truckShadowPanel.style.display = shadowDisplay;
    this.giantLogShadowPanel.style.display = shadowDisplay;

    this.hudToggleBtn.innerText = this.debugHudVisible ? '隐藏调试HUD' : '显示调试HUD';
    this.hudToggleBtn.style.backgroundColor = this.debugHudVisible
      ? 'rgba(66, 66, 66, 0.92)'
      : 'rgba(122, 215, 255, 0.92)';
    this.hudToggleBtn.style.color = this.debugHudVisible ? '#ffffff' : '#062433';
  }

  private toggleShadowPanels(): void {
    this.shadowPanelsVisible = !this.shadowPanelsVisible;
    this.refreshToggleShadowPanelsButton();
    this.refreshDebugHudVisibility();
  }

  private refreshToggleShadowPanelsButton(): void {
    this.toggleShadowPanelsBtn.innerText = this.shadowPanelsVisible ? '隐藏阴影面板' : '显示阴影面板';
    this.toggleShadowPanelsBtn.style.backgroundColor = this.shadowPanelsVisible ? 'rgba(230, 91, 91, 0.92)' : 'rgba(59, 197, 111, 0.92)';
    this.toggleShadowPanelsBtn.style.color = '#ffffff';
  }

  private toggleSpectatorMode(): void {
    this.game?.toggleSpectatorMode();
    this.refreshSpectatorButton();
  }

  private toggleCollision(): void {
    const player = this.game?.getPlayer();
    if (!player) return;
    player.setCollisionEnabled(!player.isCollisionEnabled());
    this.refreshCollisionButton();
  }

  private refreshCollisionButton(): void {
    const enabled = this.game?.getPlayer()?.isCollisionEnabled() ?? true;
    this.collisionToggleBtn.innerText = enabled
      ? 'Collision: ON (Click to disable)'
      : 'Collision: OFF (Click to restore)';
    this.collisionToggleBtn.style.backgroundColor = enabled ? 'rgba(255, 216, 0, 0.92)' : 'rgba(59, 197, 111, 0.92)';
    this.collisionToggleBtn.style.color = enabled ? '#1d1d1d' : '#ffffff';
  }

  private refreshSpectatorButton(): void {
    const enabled = this.game?.isSpectatorMode() ?? false;
    this.spectatorToggleBtn.innerText = enabled ? '旁观模式: ON' : '旁观模式';
    this.spectatorToggleBtn.style.backgroundColor = enabled ? 'rgba(122, 215, 255, 0.92)' : 'rgba(66, 66, 66, 0.92)';
    this.spectatorToggleBtn.style.color = enabled ? '#062433' : '#ffffff';
  }

  private refreshSawmillButton(): void {
    const paused = this.game?.isSawmillPaused() ?? false;
    this.sawmillToggleBtn.innerText = paused ? '压缩机: 已停止' : '压缩机: 运行中';
    this.sawmillToggleBtn.style.backgroundColor = paused ? 'rgba(230, 91, 91, 0.92)' : 'rgba(59, 197, 111, 0.92)';
    this.sawmillToggleBtn.style.color = '#ffffff';
  }

  private spawnCashStack(): void {
    this.game?.spawnRewardCashStack(50);
    this.setSpawnCashButtonState('已生成50张', 'rgba(122, 215, 255, 0.92)', '#062433');
  }

  private toggleSawmill(): void {
    this.game?.toggleSawmillPaused();
    this.refreshSawmillButton();
  }

  private toggleConveyorGroundDecals(): void {
    this.game?.toggleConveyorGroundDecals();
    this.refreshConveyorGroundDecalsButton();
  }

  private refreshConveyorGroundDecalsButton(): void {
    const visible = this.game?.isConveyorGroundDecalsVisible() ?? true;
    this.conveyorGroundDecalsBtn.innerText = visible ? '传送带地贴: ON' : '传送带地贴: OFF';
    this.conveyorGroundDecalsBtn.style.backgroundColor = visible ? 'rgba(59, 197, 111, 0.92)' : 'rgba(230, 91, 91, 0.92)';
    this.conveyorGroundDecalsBtn.style.color = '#ffffff';
  }

  private toggleConveyorArrowMovement(): void {
    this.game?.toggleConveyorArrowMovementPaused();
    this.refreshConveyorArrowPauseButton();
  }

  private refreshConveyorArrowPauseButton(): void {
    const paused = this.game?.isConveyorArrowMovementPaused() ?? false;
    this.conveyorArrowPauseBtn.innerText = paused ? '箭头移动: 暂停' : '箭头移动: 运行';
    this.conveyorArrowPauseBtn.style.backgroundColor = paused ? 'rgba(230, 91, 91, 0.92)' : 'rgba(59, 197, 111, 0.92)';
    this.conveyorArrowPauseBtn.style.color = '#ffffff';
  }

  private advanceToUnlockedConveyorStage(): void {
    this.game?.advanceToUnlockedConveyorStage();
    this.unlockStageBtn.innerText = '已跳到解锁阶段';
    window.setTimeout(() => {
      this.unlockStageBtn.innerText = '跳到解锁阶段';
    }, 900);
  }

  private refreshVisibilityButtons(): void {
    const vehiclesVisible = this.game?.areCurrentSceneVehiclesVisible() ?? true;
    this.hideVehiclesBtn.innerText = vehiclesVisible ? '隐藏车辆' : '显示车辆';
    this.hideVehiclesBtn.style.backgroundColor = vehiclesVisible ? 'rgba(230, 91, 91, 0.92)' : 'rgba(59, 197, 111, 0.92)';

    const lv3TruckVisible = this.game?.isLv3LoggingTruckVisible() ?? true;
    this.hideLv3LoggingTruckBtn.innerText = lv3TruckVisible ? '隐藏三级伐木车' : '显示三级伐木车';
    this.hideLv3LoggingTruckBtn.style.backgroundColor = lv3TruckVisible ? 'rgba(230, 91, 91, 0.92)' : 'rgba(59, 197, 111, 0.92)';

    const unlockDoorDecalBase2Visible = this.game?.isUnlockDoorDecalBase2Visible() ?? true;
    this.hideUnlockDoorDecalBase2Btn.innerText = unlockDoorDecalBase2Visible ? '隐藏灰底2' : '显示灰底2';
    this.hideUnlockDoorDecalBase2Btn.style.backgroundColor = unlockDoorDecalBase2Visible ? 'rgba(230, 91, 91, 0.92)' : 'rgba(59, 197, 111, 0.92)';
  }

  private createShadowRangeInput(min: number, max: number, step: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.style.width = '165px';
    input.oninput = () => this.applyShadowHudSettings();
    return input;
  }

  private createShadowCheckboxRow(label: string, input: HTMLInputElement): HTMLLabelElement {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';
    row.appendChild(input);
    row.appendChild(document.createTextNode(label));
    return row;
  }

  private createShadowSliderRow(label: string, input: HTMLInputElement): HTMLDivElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '10px';
    row.style.marginTop = '6px';
    const labelEl = document.createElement('span');
    labelEl.innerText = label;
    labelEl.style.width = '70px';
    row.appendChild(labelEl);
    row.appendChild(input);
    return row;
  }

  private createShadowSaveButton(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerText = label;
    button.style.marginTop = '10px';
    button.style.width = '100%';
    button.style.pointerEvents = 'auto';
    button.style.border = '0';
    button.style.borderRadius = '6px';
    button.style.padding = '7px 10px';
    button.style.fontSize = '12px';
    button.style.fontWeight = '700';
    button.style.cursor = 'pointer';
    button.style.backgroundColor = 'rgba(122, 215, 255, 0.92)';
    button.style.color = '#062433';
    button.onpointerdown = (ev) => ev.stopPropagation();
    button.onpointerup = (ev) => ev.stopPropagation();
    button.ontouchstart = (ev) => ev.stopPropagation();
    return button;
  }

  private refreshShadowHudValues(): void {
    const settings = this.game?.getPlanarShadowSettings('forest');
    if (!settings) return;
    this.shadowEnabledInput.checked = settings.enabled;
    this.shadowAlphaInput.value = settings.alpha.toFixed(2);
    this.shadowSizeInput.value = settings.footprintScale.toFixed(2);
    this.shadowBiasInput.value = settings.depthBias.toFixed(3);
    this.shadowGroundInput.value = settings.groundHeight.toFixed(3);
    this.refreshShadowHudLabel();
  }

  private applySavedShadowHudSettings(): void {
    const forest = this.readSavedShadowHudSettings('forest');
    if (forest) {
      this.writeShadowInputs(forest, this.shadowEnabledInput, this.shadowAlphaInput, this.shadowSizeInput, this.shadowBiasInput, this.shadowGroundInput);
      this.applyShadowHudSettings();
    }

    const trucks = this.readSavedShadowHudSettings('trucks');
    if (trucks) {
      this.writeShadowInputs(trucks, this.truckShadowEnabledInput, this.truckShadowAlphaInput, this.truckShadowSizeInput, this.truckShadowBiasInput, this.truckShadowGroundInput);
      this.applyTruckShadowHudSettings();
    }

    const giantLogs = this.readSavedShadowHudSettings('giant_logs');
    if (giantLogs) {
      this.writeShadowInputs(giantLogs, this.giantLogShadowEnabledInput, this.giantLogShadowAlphaInput, this.giantLogShadowSizeInput, this.giantLogShadowBiasInput, this.giantLogShadowGroundInput);
      this.applyGiantLogShadowHudSettings();
    }
  }

  private readSavedShadowHudSettings(groupId: 'forest' | 'trucks' | 'giant_logs'): Partial<{ enabled: boolean; alpha: number; footprintScale: number; depthBias: number; groundHeight: number }> | null {
    try {
      const raw = window.localStorage.getItem(this.getShadowStorageKey(groupId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : undefined,
        alpha: typeof parsed.alpha === 'number' ? parsed.alpha : undefined,
        footprintScale: typeof parsed.footprintScale === 'number' ? parsed.footprintScale : undefined,
        depthBias: typeof parsed.depthBias === 'number' ? parsed.depthBias : undefined,
        groundHeight: typeof parsed.groundHeight === 'number' ? parsed.groundHeight : undefined,
      };
    } catch {
      return null;
    }
  }

  private writeShadowInputs(
    settings: Partial<{ enabled: boolean; alpha: number; footprintScale: number; depthBias: number; groundHeight: number }>,
    enabledInput: HTMLInputElement,
    alphaInput: HTMLInputElement,
    sizeInput: HTMLInputElement,
    biasInput: HTMLInputElement,
    groundInput: HTMLInputElement,
  ): void {
    if (settings.enabled !== undefined) enabledInput.checked = settings.enabled;
    if (settings.alpha !== undefined) alphaInput.value = settings.alpha.toFixed(2);
    if (settings.footprintScale !== undefined) sizeInput.value = settings.footprintScale.toFixed(2);
    if (settings.depthBias !== undefined) biasInput.value = settings.depthBias.toFixed(3);
    if (settings.groundHeight !== undefined) groundInput.value = settings.groundHeight.toFixed(3);
  }

  private saveShadowHudSettings(groupId: 'forest' | 'trucks' | 'giant_logs'): void {
    const isForest = groupId === 'forest';
    const isTruck = groupId === 'trucks';
    const settings = {
      enabled: isForest ? this.shadowEnabledInput.checked : (isTruck ? this.truckShadowEnabledInput.checked : this.giantLogShadowEnabledInput.checked),
      alpha: Number(isForest ? this.shadowAlphaInput.value : (isTruck ? this.truckShadowAlphaInput.value : this.giantLogShadowAlphaInput.value)),
      footprintScale: Number(isForest ? this.shadowSizeInput.value : (isTruck ? this.truckShadowSizeInput.value : this.giantLogShadowSizeInput.value)),
      depthBias: Number(isForest ? this.shadowBiasInput.value : (isTruck ? this.truckShadowBiasInput.value : this.giantLogShadowBiasInput.value)),
      groundHeight: Number(isForest ? this.shadowGroundInput.value : (isTruck ? this.truckShadowGroundInput.value : this.giantLogShadowGroundInput.value)),
    };
    window.localStorage.setItem(this.getShadowStorageKey(groupId), JSON.stringify(settings));
    const button = isForest ? this.shadowSaveBtn : (isTruck ? this.truckShadowSaveBtn : this.giantLogShadowSaveBtn);
    const originalText = button.innerText;
    button.innerText = '已保存';
    window.setTimeout(() => {
      button.innerText = originalText;
    }, 900);
  }

  private getShadowStorageKey(groupId: 'forest' | 'trucks' | 'giant_logs'): string {
    return `lumber_order.planarShadow.${groupId}`;
  }

  private refreshShadowHudLabel(): void {
    if (!this.shadowValueText) return;
    this.shadowValueText.innerText = `alpha ${Number(this.shadowAlphaInput.value).toFixed(2)} / size ${Number(this.shadowSizeInput.value).toFixed(2)} / bias ${Number(this.shadowBiasInput.value).toFixed(3)} / y ${Number(this.shadowGroundInput.value).toFixed(3)}`;
  }

  private applyShadowHudSettings(): void {
    this.game?.updatePlanarShadowSettings({
      enabled: this.shadowEnabledInput.checked,
      alpha: Number(this.shadowAlphaInput.value),
      footprintScale: Number(this.shadowSizeInput.value),
      depthBias: Number(this.shadowBiasInput.value),
      groundHeight: Number(this.shadowGroundInput.value),
    }, 'forest');
    this.refreshShadowHudLabel();
  }

  private refreshTruckShadowHudValues(): void {
    const settings = this.game?.getPlanarShadowSettings('trucks');
    if (!settings) return;
    this.truckShadowEnabledInput.checked = settings.enabled;
    this.truckShadowAlphaInput.value = settings.alpha.toFixed(2);
    this.truckShadowSizeInput.value = settings.footprintScale.toFixed(2);
    this.truckShadowBiasInput.value = settings.depthBias.toFixed(3);
    this.truckShadowGroundInput.value = settings.groundHeight.toFixed(3);
    this.refreshTruckShadowHudLabel();
  }

  private refreshTruckShadowHudLabel(): void {
    if (!this.truckShadowValueText) return;
    this.truckShadowValueText.innerText = `alpha ${Number(this.truckShadowAlphaInput.value).toFixed(2)} / size ${Number(this.truckShadowSizeInput.value).toFixed(2)} / bias ${Number(this.truckShadowBiasInput.value).toFixed(3)} / y ${Number(this.truckShadowGroundInput.value).toFixed(3)}`;
  }

  private applyTruckShadowHudSettings(): void {
    this.game?.updatePlanarShadowSettings({
      enabled: this.truckShadowEnabledInput.checked,
      alpha: Number(this.truckShadowAlphaInput.value),
      footprintScale: Number(this.truckShadowSizeInput.value),
      depthBias: Number(this.truckShadowBiasInput.value),
      groundHeight: Number(this.truckShadowGroundInput.value),
    }, 'trucks');
    this.refreshTruckShadowHudLabel();
  }

  private refreshGiantLogShadowHudValues(): void {
    const settings = this.game?.getPlanarShadowSettings('giant_logs');
    if (!settings) return;
    this.giantLogShadowEnabledInput.checked = settings.enabled;
    this.giantLogShadowAlphaInput.value = settings.alpha.toFixed(2);
    this.giantLogShadowSizeInput.value = settings.footprintScale.toFixed(2);
    this.giantLogShadowBiasInput.value = settings.depthBias.toFixed(3);
    this.giantLogShadowGroundInput.value = settings.groundHeight.toFixed(3);
    this.refreshGiantLogShadowHudLabel();
  }

  private refreshGiantLogShadowHudLabel(): void {
    if (!this.giantLogShadowValueText) return;
    this.giantLogShadowValueText.innerText = `alpha ${Number(this.giantLogShadowAlphaInput.value).toFixed(2)} / size ${Number(this.giantLogShadowSizeInput.value).toFixed(2)} / bias ${Number(this.giantLogShadowBiasInput.value).toFixed(3)} / y ${Number(this.giantLogShadowGroundInput.value).toFixed(3)}`;
  }

  private applyGiantLogShadowHudSettings(): void {
    this.game?.updatePlanarShadowSettings({
      enabled: this.giantLogShadowEnabledInput.checked,
      alpha: Number(this.giantLogShadowAlphaInput.value),
      footprintScale: Number(this.giantLogShadowSizeInput.value),
      depthBias: Number(this.giantLogShadowBiasInput.value),
      groundHeight: Number(this.giantLogShadowGroundInput.value),
    }, 'giant_logs');
    this.refreshGiantLogShadowHudLabel();
  }

  private hideVehicles(): void {
    this.game?.toggleCurrentSceneVehicles();
    this.refreshVisibilityButtons();
  }

  private hideLv3LoggingTruck(): void {
    this.game?.toggleLv3LoggingTruck();
    this.refreshVisibilityButtons();
  }

  private hideUnlockDoorDecalBase2(): void {
    this.game?.toggleUnlockDoorDecalBase2();
    this.refreshVisibilityButtons();
  }

  private revealAllObjects(): void {
    this.game?.revealAllObjects();
    this.setRevealAllButtonState('已显示全部', 'rgba(122, 215, 255, 0.92)', '#062433');
  }

  private setSpawnCashButtonState(label: string, bg: string, color: string): void {
    this.spawnCashBtn.innerText = label;
    this.spawnCashBtn.style.backgroundColor = bg;
    this.spawnCashBtn.style.color = color;
    if (this.spawnCashResetTimer !== null) {
      window.clearTimeout(this.spawnCashResetTimer);
    }
    this.spawnCashResetTimer = window.setTimeout(() => {
      this.spawnCashBtn.innerText = '生成50美钞';
      this.spawnCashBtn.style.backgroundColor = 'rgba(59, 197, 111, 0.92)';
      this.spawnCashBtn.style.color = '#ffffff';
      this.spawnCashResetTimer = null;
    }, 1200);
  }

  private setRevealAllButtonState(label: string, bg: string, color: string): void {
    this.revealAllBtn.innerText = label;
    this.revealAllBtn.style.backgroundColor = bg;
    this.revealAllBtn.style.color = color;
    if (this.revealAllResetTimer !== null) {
      window.clearTimeout(this.revealAllResetTimer);
    }
    this.revealAllResetTimer = window.setTimeout(() => {
      this.revealAllBtn.innerText = '显示所有物体';
      this.revealAllBtn.style.backgroundColor = 'rgba(59, 197, 111, 0.92)';
      this.revealAllBtn.style.color = '#ffffff';
      this.revealAllResetTimer = null;
    }, 1200);
  }

  dispose(): void {
    if (this.spawnCashResetTimer !== null) {
      window.clearTimeout(this.spawnCashResetTimer);
      this.spawnCashResetTimer = null;
    }
    if (this.revealAllResetTimer !== null) {
      window.clearTimeout(this.revealAllResetTimer);
      this.revealAllResetTimer = null;
    }
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.game = null;
  }
}
