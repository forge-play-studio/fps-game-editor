import assetModel from './models/asset.glb?url';
import { GENERATED_MODEL_URL_MAP } from './generated/model-registry.generated';

/**
 * 资源管理模块 (Scaffold)
 *
 * 目的：
 * - 统一管理静态资源 (models / textures / ui / sounds)
 * - 提供“modelId → URL” 的唯一映射入口
 * - 保持与架构文档一致：业务代码只使用 modelId，不直接写资源路径
 *
 * 注意：这是脚手架版本，已剔除与具体游戏强绑定的资源。
 * 你可以按需新增资源：
 * 1) 将资源文件放进 src/assets/**
 * 2) 在本文件使用 ?url 引入
 * 3) 写入 MODEL_URL_MAP / TextureAssets / SoundAssets 等映射
 */
// ============================================================
// Placeholders (可替换)
// ============================================================
import blankPng from './placeholders/blank.png?url';
import guideArrowPng from './箭头.png?url';
import conveyorPng from './传送带.png?url';
import conveyorArrowPng from './传送带箭头.png?url';
import operationPng from './操作.png?url';
import truckUpgradePng from './升级车.png?url';
import unlockDoorPng from './解锁门.png?url';
import kuojianPng from './扩建.png?url';
import kuojian2Png from './扩建2.png?url';
import price400Png from './400.png?url';
import price300Png from './300.png?url';
import price600Png from './600.png?url';
import lockPng from './锁.png?url';
import plusPng from './加号.png?url';
import shoumaiPng from './售卖.png?url';
import sellDecalBasePng from './地贴灰底.png?url';
import sellDecalFramePng from './地贴边框.png?url';
import sellDecalLabelPng from './售卖sell.png?url';
import sellDecalGreenFramePng from './绿边框.png?url';
import conveyorDecalIconPng from './传送带图标.png?url';
import conveyorDecal20Png from './传送带20.png?url';
import conveyorDecal2Png from './传送带2.png?url';
import money2Png from './钱2.png?url';
import squareDecalDashedPng from './方地贴虚线.png?url';
import squareDecalBasePng from './方地贴灰底.png?url';
import greenSquareDecalDashedPng from './绿方地贴虚线.png?url';
import silentWav from './placeholders/silent.wav?url';
import conveyorGlb from './传送带.glb?url';
import peelerGlb from './削皮器.glb?url';
import fenceGlb from './围栏.glb?url';
import giantLogGlb from './巨木.glb?url';
import giantLogCartoonGlb from './低多边形卡通风格圆木_SSD_S_M_MuTou.glb?url';
import rawLogGlb from './原木.glb?url';
import collectTableGlb from './收集桌子.glb?url';
import collectPlatformGlb from './收集台子.glb?url';
import cashRegisterGlb from './收银机.glb?url';
import boardCompressorLv1Glb from './木板压缩机1级.glb?url';
import treeLv1Glb from './树一级.glb?url';
import treeLv2Glb from './树二级.glb?url';
import treeLv3SongShuGlb from './卡通低多边形常绿松树_SongShu.glb?url';
import treeLv3FirGlb from './低多边形卡通风格冷杉树_松树.glb?url';
import truckLv2Glb from './二级伐木车.glb?url';
import truckLv3Glb from './三级伐木车_v2.glb?url';
import truckLv3NewGlb from './三级车.glb?url';
import whitePlaneGlb from './白Plane.glb?url';
import truckRedGlb from './红卡车.glb?url';
import doorGlb from './门.glb?url';
import lockDoorGlb from './suo_.glb?url';
import circularSawGlb from './Meshy_AI_Circular_Saw_Demoliti_0429140400_texture.glb?url';
import lumberMillSmallGlb from './低多边形卡通风格伐木场_伐木场小.glb?url';
import cashBillGlb from './美钞.glb?url';
import plankGlb from './木板.glb?url';
import axeGlb from './斧子.glb?url';
import reinforcedWoodBoxGlb from './卡通风格加固木质箱子_箱子.glb?url';
import cartoonWoodBoxGlb from './卡通风格加固木质箱子_箱子.glb?url';
import groundCornerGlb from './地面_转角.glb?url';
import groundStraightGlb from './地面_直.glb?url';
import smDiban11Glb from './SM_diban1_1.glb?url';
import smDiban11HuangGlb from './黄Plane.glb?url';
import smDiban12Glb from './SM_diban1_2.glb?url';
import smDiban12CaoGlb from './cao.glb?url';
import smDiban13Glb from './SM_diban1_3.glb?url';
import smDiban13GrayWhiteGlb from './方砖Plane.glb?url';
import plane33Glb from './33Plane.glb?url';
import smDiban14Glb from './SM_diban1_4.glb?url';
import smDiban14MaluGlb from './malu.glb?url';
import curvedPlane1Glb from './弯Plane1.glb?url';
import straightPlaneGlb from './直Plane.glb?url';
import smSidewalkCurved41Glb from './SM_Sidewalk_Curved4(1).glb?url';
import curbInnerGlb from './路牙_内.glb?url';
import curbOuterGlb from './路牙_外.glb?url';
import curbStraightGlb from './路牙_直.glb?url';
// ============================================================
// Models
// ============================================================
/**
 * modelId → 资源 URL 的映射
 *
 * 这是唯一定义 modelId 和实际资源路径对应关系的地方。
 *
 * Scaffold 默认不内置任何具体模型，你可以在此处逐步注册：
 * ```ts
 * import heroModel from './models/hero.glb?url';
 * export const MODEL_URL_MAP = { hero: heroModel };
 * ```
 */
const MANUAL_MODEL_URL_MAP: Record<string, string> = {
    conveyor: conveyorGlb,
    peeler: peelerGlb,
    fence: fenceGlb,
    giant_log: giantLogGlb,
    giant_log_cartoon: giantLogCartoonGlb,
    raw_log: rawLogGlb,
    collect_table: collectTableGlb,
    collect_platform: collectPlatformGlb,
    cash_register: cashRegisterGlb,
    board_compressor_lv1: boardCompressorLv1Glb,
    tree_lv1: treeLv1Glb,
    tree_lv2: treeLv2Glb,
    tree_lv3_songshu: treeLv3SongShuGlb,
    tree_lv3_fir: treeLv3FirGlb,
    truck_lv2: truckLv2Glb,
    truck_lv3: truckLv3Glb,
    truck_lv3_new: truckLv3NewGlb,
    white_plane: whitePlaneGlb,
    red_truck: truckRedGlb,
    door_leaf: doorGlb,
    door_lock: lockDoorGlb,
    circular_saw: circularSawGlb,
    lumber_mill_small: lumberMillSmallGlb,
    cash_bill: cashBillGlb,
    plank: plankGlb,
    axe: axeGlb,
    reinforced_wood_box: reinforcedWoodBoxGlb,
    cartoon_wood_box: cartoonWoodBoxGlb,
    ground_corner: groundCornerGlb,
    ground_straight: groundStraightGlb,
    sm_diban1_1: smDiban11Glb,
    sm_diban1_1_huang: smDiban11HuangGlb,
    sm_diban1_2: smDiban12Glb,
    sm_diban1_2_cao: smDiban12CaoGlb,
    sm_diban1_3: smDiban13Glb,
    sm_diban1_3_graywhite: smDiban13GrayWhiteGlb,
    plane_33: plane33Glb,
    sm_diban1_4: smDiban14Glb,
    sm_diban1_4_malu: smDiban14MaluGlb,
    curved_plane_1: curvedPlane1Glb,
    straight_plane: straightPlaneGlb,
    sm_sidewalk_curved4_1: smSidewalkCurved41Glb,
    curb_inner: curbInnerGlb,
    curb_outer: curbOuterGlb,
    curb_straight: curbStraightGlb,
    asset: assetModel,
};

export const MODEL_URL_MAP: Record<string, string> = {
    ...MANUAL_MODEL_URL_MAP,
    ...GENERATED_MODEL_URL_MAP,
};
/** 根据 modelId 获取资源 URL */
export function resolveModelUrl(modelId: string): string | undefined {
    return MODEL_URL_MAP[modelId];
}
/** 获取所有已注册的模型 ID */
export function getAllModelIds(): string[] {
    return Object.keys(MODEL_URL_MAP);
}
/** 检查模型 ID 是否已注册 */
export function isModelRegistered(modelId: string): boolean {
    return modelId in MODEL_URL_MAP;
}
// ============================================================
// UI Images (可选)
// ============================================================
/**
 * UIImages
 *
 * 用于 UI、粒子特效等需要图片纹理 URL 的场景。
 * Scaffold 默认全部指向 blank 占位图。
 */
export const UIImages: Record<string, string> = {
    blank: blankPng,
    gameLogo: blankPng,
    particleSpark: blankPng,
    particleSoft: blankPng,
};
// ============================================================
// Sounds (可选)
// ============================================================
/**
 * SoundAssets
 *
 * Scaffold 默认提供静音音频占位，避免 AudioService 在启用时因为缺失资源而报错。
 * 你可以替换为实际的 mp3/wav：
 * ```ts
 * import bgm from './Sound/bgm.mp3?url';
 * ```
 */
export const SoundAssets = {
    bgm: silentWav,
    coin: silentWav,
    harvest: silentWav,
    unlock: silentWav,
};
// ============================================================
// Textures (可选)
// ============================================================
/**
 * TextureAssets
 *
 * 用于 Babylon GUI 或其他材质贴图等。
 */
export const TextureAssets: Record<string, any> = {
    ui: {
        gameLogo: blankPng,
        guide_arrow: guideArrowPng,
    },
    ground: {
        conveyor: conveyorPng,
        conveyor_arrow: conveyorArrowPng,
        operation: operationPng,
        truck_upgrade: truckUpgradePng,
        unlock_door: unlockDoorPng,
        kuojian: kuojianPng,
        kuojian_2: kuojian2Png,
        price_400: price400Png,
        price_300: price300Png,
        price_600: price600Png,
        lock: lockPng,
        plus: plusPng,
        shoumai: shoumaiPng,
        sell_decal_base: sellDecalBasePng,
        sell_decal_frame: sellDecalFramePng,
        sell_decal_label: sellDecalLabelPng,
        sell_decal_green_frame: sellDecalGreenFramePng,
        conveyor_decal_icon: conveyorDecalIconPng,
        conveyor_decal_20: conveyorDecal20Png,
        conveyor_decal_2: conveyorDecal2Png,
        money_2: money2Png,
        square_decal_dashed: squareDecalDashedPng,
        square_decal_base: squareDecalBasePng,
        green_square_decal_dashed: greenSquareDecalDashedPng,
    }
};
// ============================================================
// GLB Path Helper
// ============================================================
import { isCompressedGlb, getUsableGlbUrl } from '../utils/glbDecompress';
/** getModelPathAndFileAsync 的返回类型 */
export interface ModelPathInfo {
    path: string;
    filename: string;
    isDataUrl: boolean;
    /** 是否为压缩的 GLB（需要运行时解压） */
    isCompressed: boolean;
}
/**
 * 从完整 URL 中提取 path 和 filename
 * 用于 Babylon SceneLoader.ImportMeshAsync / LoadAssetContainerAsync
 */
export async function getModelPathAndFileAsync(url: string): Promise<ModelPathInfo> {
    // 1) 压缩 GLB（例如单文件构建产出的 data:application/x-glb-gzip;base64,...）
    if (isCompressedGlb(url)) {
        const usableUrl = await getUsableGlbUrl(url);
        return splitUrlToPathAndFile(usableUrl, true);
    }
    // 2) 其他 data URL (base64 内联)
    if (url.startsWith('data:')) {
        return {
            path: '',
            filename: url,
            isDataUrl: true,
            isCompressed: false,
        };
    }
    // 3) 普通 URL
    return splitUrlToPathAndFile(url, false);
}
function splitUrlToPathAndFile(url: string, isCompressed: boolean): ModelPathInfo {
    const idx = url.lastIndexOf('/');
    if (idx === -1) {
        return {
            path: '',
            filename: url,
            isDataUrl: false,
            isCompressed,
        };
    }
    return {
        path: url.slice(0, idx + 1),
        filename: url.slice(idx + 1),
        isDataUrl: false,
        isCompressed,
    };
}
