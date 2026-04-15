import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

function requireManager(req, res, next) {
  if (req.user?.role !== "manager") {
    return res.status(403).json({ error: "Chỉ quản lý mới được thao tác học phí" });
  }
  next();
}

router.use(requireManager);

const PERIOD_STATUSES = new Set(["draft", "published", "closed"]);
const CHARGE_TIMINGS = new Set(["advance", "arrears"]);
const QUANTITY_MODES = new Set(["fixed", "actual_days"]);
const FORMULA_TYPES = new Set(["fixed_x_price_x_frequency", "fixed_x_price", "actual_days_x_price"]);
const ITEM_CATEGORIES = new Set(["fixed", "daily", "service", "one_time", "adjustment"]);
const ITEM_CALC_TYPES = new Set([
  "monthly_fixed",
  "attendance_days",
  "meal_days",
  "service_fixed",
  "service_usage",
  "one_time",
  "manual",
]);
const BILLING_CYCLES = new Set(["monthly", "one_time", "ad_hoc"]);
const PRORATION_MODES = new Set(["full_month", "half_month", "actual_days"]);
const SCOPE_TYPES = new Set(["all", "levels", "classes"]);
const DISCOUNT_TYPES = new Set(["amount", "percent"]);
const DISCOUNT_SCOPES = new Set(["invoice", "item_category", "item_code"]);
const SERVICE_STATUSES = new Set(["active", "paused", "stopped"]);
const ADJUSTMENT_TYPES = new Set(["charge", "discount", "refund", "carry_forward"]);

function toMoney(value) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function csvToStringList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function csvToNumberList(value) {
  return csvToStringList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function normalizeMonthKey(value, fieldName = "monthKey") {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) {
    return { error: `${fieldName} must be in YYYY-MM format` };
  }
  return s;
}

function normalizeDate(value, fieldName) {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { error: `${fieldName} must be a valid date (YYYY-MM-DD)` };
  }
  return s;
}

function normalizeOptionalDate(value, fieldName) {
  if (value == null || String(value).trim() === "") return null;
  return normalizeDate(value, fieldName);
}

function normalizeMoney(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${fieldName} must be a non-negative number` };
  }
  return roundMoney(n);
}

function normalizeSignedMoney(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return { error: `${fieldName} must be a number` };
  }
  return roundMoney(n);
}

function normalizeEnum(value, allowed, fieldName, defaultValue) {
  const s = String(value ?? defaultValue ?? "").trim().toLowerCase();
  if (!allowed.has(s)) {
    return { error: `${fieldName} is invalid` };
  }
  return s;
}

function normalizeText(value, fieldName) {
  const s = String(value ?? "").trim();
  if (!s) return { error: `${fieldName} is required` };
  return s;
}

function normalizeCode(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return { error: "code is required" };
  const s = raw.replace(/[^A-Z0-9_-]/g, "");
  if (!s) return { error: "code is invalid" };
  return s;
}

function normalizeWeekdays(value) {
  const raw = Array.isArray(value) ? value : csvToStringList(value);
  const days = [...new Set(raw.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))];
  if (!days.length) return { error: "chargeWeekdays must include at least one weekday from 0 to 6" };
  return days.sort((a, b) => a - b);
}

function normalizeStringArray(value) {
  const items = Array.isArray(value) ? value : csvToStringList(value);
  return [...new Set(items.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function normalizePositiveIntArray(value) {
  const items = Array.isArray(value) ? value : csvToNumberList(value);
  return [...new Set(items.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))].sort((a, b) => a - b);
}

function monthBounds(monthKey) {
  const [yearText, monthText] = String(monthKey).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function dateOnly(date) {
  if (!date) return "";
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

function parseDate(dateText) {
  if (!dateText) return null;
  const text = dateOnly(dateText);
  if (!text) return null;
  return new Date(`${text}T00:00:00.000Z`);
}

function compareMonthKeys(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function monthInRange(monthKey, startMonth, endMonth) {
  const start = String(startMonth ?? "").trim();
  const end = String(endMonth ?? "").trim();
  if (start && compareMonthKeys(monthKey, start) < 0) return false;
  if (end && compareMonthKeys(monthKey, end) > 0) return false;
  return true;
}

function countMatchingWeekdays(rangeStart, rangeEnd, weekdays) {
  const selected = Array.isArray(weekdays) && weekdays.length ? weekdays : [1, 2, 3, 4, 5, 6];
  const start = parseDate(rangeStart);
  const end = parseDate(rangeEnd);
  if (!start || !end || start > end) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (selected.includes(cursor.getUTCDay())) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function getEffectiveDateRange(monthKey, ...datePairs) {
  const { start, end } = monthBounds(monthKey);
  let currentStart = new Date(start);
  let currentEnd = new Date(end);
  for (const pair of datePairs) {
    if (!pair) continue;
    const [from, to] = pair;
    const parsedFrom = parseDate(from);
    const parsedTo = parseDate(to);
    if (parsedFrom && parsedFrom > currentStart) currentStart = parsedFrom;
    if (parsedTo && parsedTo < currentEnd) currentEnd = parsedTo;
  }
  if (currentStart > currentEnd) return null;
  return { start: currentStart, end: currentEnd };
}

function computeProrationFactor(mode, monthKey, weekdays, ...datePairs) {
  const effective = getEffectiveDateRange(monthKey, ...datePairs);
  if (!effective) return 0;
  const { start, end } = monthBounds(monthKey);
  const fullStart = dateOnly(start);
  const fullEnd = dateOnly(end);
  const effectiveStart = dateOnly(effective.start);
  const effectiveEnd = dateOnly(effective.end);

  if (mode === "full_month") return 1;
  if (mode === "half_month") {
    const startsLate = effectiveStart.slice(-2) >= "16";
    const endsEarly = effectiveEnd.slice(-2) <= "15";
    return startsLate || endsEarly ? 0.5 : 1;
  }

  const totalDays = countMatchingWeekdays(fullStart, fullEnd, weekdays);
  const activeDays = countMatchingWeekdays(effectiveStart, effectiveEnd, weekdays);
  if (!totalDays) return 0;
  return roundMoney(activeDays / totalDays);
}

function formatFormula(parts) {
  return parts.filter(Boolean).join(" | ");
}

function mapTemplateRow(row) {
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    category: row.category ?? "fixed",
    calcType: row.calc_type ?? "monthly_fixed",
    billingCycle: row.billing_cycle ?? "monthly",
    description: row.description ?? "",
    chargeTiming: row.charge_timing ?? "advance",
    quantityMode: row.quantity_mode ?? "fixed",
    unitPrice: toMoney(row.unit_price),
    unitName: row.unit_name ?? "tháng",
    fixedQuantity: toMoney(row.fixed_quantity),
    formulaType: row.formula_type ?? "fixed_x_price_x_frequency",
    frequencyMultiplier: toMoney(row.frequency_multiplier || 1),
    chargeWeekdays: normalizeWeekdays(row.charge_weekdays).error ? [1, 2, 3, 4, 5, 6] : normalizeWeekdays(row.charge_weekdays),
    isOptional: Boolean(row.is_optional),
    sortOrder: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
    effectiveStartMonth: row.effective_start_month ?? "",
    effectiveEndMonth: row.effective_end_month ?? "",
    scopeType: row.scope_type ?? "all",
    applyLevels: csvToStringList(row.apply_levels),
    applyClassIds: csvToNumberList(row.apply_class_ids),
    prorationMode: row.proration_mode ?? "full_month",
    defaultAmount: toMoney(row.default_amount),
  };
}

function mapPeriodItemRow(row) {
  return {
    id: row.id,
    periodId: row.period_id,
    templateId: row.template_id,
    code: row.code ?? "",
    name: row.name,
    category: row.category ?? "fixed",
    calcType: row.calc_type ?? "monthly_fixed",
    billingCycle: row.billing_cycle ?? "monthly",
    description: row.description ?? "",
    amount: toMoney(row.amount),
    chargeTiming: row.charge_timing ?? "advance",
    quantityMode: row.quantity_mode ?? "fixed",
    unitPrice: toMoney(row.unit_price),
    unitName: row.unit_name ?? "tháng",
    fixedQuantity: toMoney(row.fixed_quantity),
    formulaType: row.formula_type ?? "fixed_x_price_x_frequency",
    frequencyMultiplier: toMoney(row.frequency_multiplier || 1),
    chargeWeekdays: normalizeWeekdays(row.charge_weekdays).error ? [1, 2, 3, 4, 5, 6] : normalizeWeekdays(row.charge_weekdays),
    isOptional: Boolean(row.is_optional),
    sortOrder: Number(row.sort_order ?? 0),
    scopeType: row.scope_type ?? "all",
    applyLevels: csvToStringList(row.apply_levels),
    applyClassIds: csvToNumberList(row.apply_class_ids),
    prorationMode: row.proration_mode ?? "full_month",
  };
}

function mapPeriodRow(row) {
  return {
    id: row.id,
    monthKey: row.month_key,
    title: row.title,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : "",
    status: row.status,
    itemCount: Number(row.item_count ?? 0),
    studentCount: Number(row.student_count ?? 0),
    totalFinalAmount: toMoney(row.total_final_amount),
    totalPaidAmount: toMoney(row.total_paid_amount),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

function mapPolicyRow(row) {
  return {
    id: row.id,
    name: row.name,
    discountType: row.discount_type,
    discountValue: toMoney(row.discount_value),
    applyScope: row.apply_scope ?? "invoice",
    targetCategory: row.target_category ?? "",
    targetFeeItemCode: row.target_fee_item_code ?? "",
    startMonth: row.start_month,
    endMonth: row.end_month ?? "",
    active: Boolean(row.active),
    note: row.note ?? "",
    studentCount: Number(row.student_count ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

function mapServiceRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name ?? "",
    classId: row.class_id ?? null,
    className: row.class_name ?? "",
    feeItemTemplateId: row.fee_item_template_id,
    feeItemCode: row.fee_item_code ?? "",
    feeItemName: row.fee_item_name ?? "",
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    status: row.status ?? "active",
    quantityOverride: row.quantity_override == null ? null : toMoney(row.quantity_override),
    unitPriceOverride: row.unit_price_override == null ? null : toMoney(row.unit_price_override),
    usageQuantity: row.usage_quantity == null ? null : toMoney(row.usage_quantity),
    usageMonthKey: row.usage_month_key ?? "",
    note: row.note ?? "",
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

function buildTemplateValues(body, current = null) {
  const code = body.code !== undefined ? normalizeCode(body.code) : normalizeCode(current?.code || "");
  if (code?.error) return code;
  const name = body.name !== undefined ? normalizeText(body.name, "name") : normalizeText(current?.name, "name");
  if (name?.error) return name;
  const category =
    body.category !== undefined
      ? normalizeEnum(body.category, ITEM_CATEGORIES, "category", "fixed")
      : current?.category ?? "fixed";
  if (category?.error) return category;
  const calcType =
    body.calcType !== undefined
      ? normalizeEnum(body.calcType, ITEM_CALC_TYPES, "calcType", "monthly_fixed")
      : current?.calc_type ?? "monthly_fixed";
  if (calcType?.error) return calcType;
  const billingCycle =
    body.billingCycle !== undefined
      ? normalizeEnum(body.billingCycle, BILLING_CYCLES, "billingCycle", "monthly")
      : current?.billing_cycle ?? "monthly";
  if (billingCycle?.error) return billingCycle;
  const chargeTiming =
    body.chargeTiming !== undefined
      ? normalizeEnum(body.chargeTiming, CHARGE_TIMINGS, "chargeTiming", "advance")
      : current?.charge_timing ?? "advance";
  if (chargeTiming?.error) return chargeTiming;
  const quantityMode =
    body.quantityMode !== undefined
      ? normalizeEnum(body.quantityMode, QUANTITY_MODES, "quantityMode", "fixed")
      : current?.quantity_mode ?? "fixed";
  if (quantityMode?.error) return quantityMode;
  const unitPrice = body.unitPrice !== undefined ? normalizeMoney(body.unitPrice, "unitPrice") : toMoney(current?.unit_price);
  if (unitPrice?.error) return unitPrice;
  const unitName = body.unitName !== undefined ? normalizeText(body.unitName, "unitName") : normalizeText(current?.unit_name || "tháng", "unitName");
  if (unitName?.error) return unitName;
  const fixedQuantity =
    body.fixedQuantity !== undefined ? normalizeMoney(body.fixedQuantity, "fixedQuantity") : toMoney(current?.fixed_quantity ?? 1);
  if (fixedQuantity?.error) return fixedQuantity;
  const formulaType =
    body.formulaType !== undefined
      ? normalizeEnum(body.formulaType, FORMULA_TYPES, "formulaType", quantityMode === "actual_days" ? "actual_days_x_price" : "fixed_x_price_x_frequency")
      : current?.formula_type ?? (quantityMode === "actual_days" ? "actual_days_x_price" : "fixed_x_price_x_frequency");
  if (formulaType?.error) return formulaType;
  const frequencyMultiplier =
    body.frequencyMultiplier !== undefined
      ? normalizeMoney(body.frequencyMultiplier, "frequencyMultiplier")
      : toMoney(current?.frequency_multiplier ?? 1);
  if (frequencyMultiplier?.error) return frequencyMultiplier;
  const chargeWeekdays =
    body.chargeWeekdays !== undefined
      ? normalizeWeekdays(body.chargeWeekdays)
      : normalizeWeekdays(current?.charge_weekdays ?? [1, 2, 3, 4, 5, 6]);
  if (chargeWeekdays?.error) return chargeWeekdays;
  const scopeType =
    body.scopeType !== undefined
      ? normalizeEnum(body.scopeType, SCOPE_TYPES, "scopeType", "all")
      : current?.scope_type ?? "all";
  if (scopeType?.error) return scopeType;
  const prorationMode =
    body.prorationMode !== undefined
      ? normalizeEnum(body.prorationMode, PRORATION_MODES, "prorationMode", "full_month")
      : current?.proration_mode ?? "full_month";
  if (prorationMode?.error) return prorationMode;

  const applyLevels = normalizeStringArray(body.applyLevels !== undefined ? body.applyLevels : current?.apply_levels);
  const applyClassIds = normalizePositiveIntArray(body.applyClassIds !== undefined ? body.applyClassIds : current?.apply_class_ids);
  const effectiveStartMonth =
    body.effectiveStartMonth !== undefined && String(body.effectiveStartMonth).trim() !== ""
      ? normalizeMonthKey(body.effectiveStartMonth, "effectiveStartMonth")
      : current?.effective_start_month ?? "";
  if (effectiveStartMonth?.error) return effectiveStartMonth;
  const effectiveEndMonth =
    body.effectiveEndMonth !== undefined && String(body.effectiveEndMonth).trim() !== ""
      ? normalizeMonthKey(body.effectiveEndMonth, "effectiveEndMonth")
      : current?.effective_end_month ?? "";
  if (effectiveEndMonth?.error) return effectiveEndMonth;

  const description = body.description !== undefined ? String(body.description ?? "").trim() : current?.description ?? "";
  const sortOrder = body.sortOrder !== undefined ? Number(body.sortOrder || 0) : Number(current?.sort_order || 0);
  const isOptional = body.isOptional !== undefined ? Boolean(body.isOptional) : Boolean(current?.is_optional);
  const active = body.active !== undefined ? Boolean(body.active) : Boolean(current?.active ?? true);
  const multiplier = formulaType === "fixed_x_price_x_frequency" ? frequencyMultiplier : 1;
  const defaultAmount = quantityMode === "actual_days" ? unitPrice * fixedQuantity : unitPrice * fixedQuantity * multiplier;

  return {
    code,
    name,
    category,
    calcType,
    billingCycle,
    description,
    chargeTiming,
    quantityMode,
    unitPrice,
    unitName,
    fixedQuantity,
    formulaType,
    frequencyMultiplier,
    chargeWeekdays,
    scopeType,
    applyLevels,
    applyClassIds,
    effectiveStartMonth,
    effectiveEndMonth,
    prorationMode,
    isOptional,
    sortOrder,
    active,
    defaultAmount: roundMoney(defaultAmount),
  };
}

function buildPolicyValues(body, current = null) {
  const name = body.name !== undefined ? normalizeText(body.name, "name") : normalizeText(current?.name, "name");
  if (name?.error) return name;
  const discountType =
    body.discountType !== undefined
      ? normalizeEnum(body.discountType, DISCOUNT_TYPES, "discountType", "amount")
      : current?.discount_type ?? "amount";
  if (discountType?.error) return discountType;
  const discountValue =
    body.discountValue !== undefined ? normalizeMoney(body.discountValue, "discountValue") : toMoney(current?.discount_value);
  if (discountValue?.error) return discountValue;
  if (discountType === "percent" && discountValue > 100) {
    return { error: "discountValue percent cannot exceed 100" };
  }
  const applyScope =
    body.applyScope !== undefined
      ? normalizeEnum(body.applyScope, DISCOUNT_SCOPES, "applyScope", "invoice")
      : current?.apply_scope ?? "invoice";
  if (applyScope?.error) return applyScope;
  const targetCategory =
    body.targetCategory !== undefined ? String(body.targetCategory ?? "").trim() : current?.target_category ?? "";
  const targetFeeItemCode =
    body.targetFeeItemCode !== undefined ? String(body.targetFeeItemCode ?? "").trim().toUpperCase() : current?.target_fee_item_code ?? "";
  const startMonth =
    body.startMonth !== undefined ? normalizeMonthKey(body.startMonth, "startMonth") : current?.start_month;
  if (startMonth?.error) return startMonth;
  const endMonth =
    body.endMonth !== undefined && String(body.endMonth).trim() !== ""
      ? normalizeMonthKey(body.endMonth, "endMonth")
      : current?.end_month ?? "";
  if (endMonth?.error) return endMonth;
  return {
    name,
    discountType,
    discountValue,
    applyScope,
    targetCategory,
    targetFeeItemCode,
    startMonth,
    endMonth,
    active: body.active !== undefined ? Boolean(body.active) : Boolean(current?.active ?? true),
    note: body.note !== undefined ? String(body.note ?? "").trim() : current?.note ?? "",
    studentIds: normalizePositiveIntArray(body.studentIds !== undefined ? body.studentIds : []),
  };
}

function buildServiceValues(body, current = null) {
  const studentId = Number(body.studentId ?? current?.student_id);
  if (!Number.isInteger(studentId) || studentId <= 0) return { error: "studentId is required" };
  const feeItemTemplateId = Number(body.feeItemTemplateId ?? current?.fee_item_template_id);
  if (!Number.isInteger(feeItemTemplateId) || feeItemTemplateId <= 0) return { error: "feeItemTemplateId is required" };
  const startDate = body.startDate !== undefined ? normalizeDate(body.startDate, "startDate") : dateOnly(current?.start_date);
  if (startDate?.error) return startDate;
  const endDate =
    body.endDate !== undefined ? normalizeOptionalDate(body.endDate, "endDate") : dateOnly(current?.end_date);
  if (endDate?.error) return endDate;
  const status =
    body.status !== undefined
      ? normalizeEnum(body.status, SERVICE_STATUSES, "status", "active")
      : current?.status ?? "active";
  if (status?.error) return status;
  const quantityOverride =
    body.quantityOverride !== undefined && body.quantityOverride !== null && String(body.quantityOverride).trim() !== ""
      ? normalizeMoney(body.quantityOverride, "quantityOverride")
      : current?.quantity_override == null
        ? null
        : toMoney(current?.quantity_override);
  if (quantityOverride?.error) return quantityOverride;
  const unitPriceOverride =
    body.unitPriceOverride !== undefined && body.unitPriceOverride !== null && String(body.unitPriceOverride).trim() !== ""
      ? normalizeMoney(body.unitPriceOverride, "unitPriceOverride")
      : current?.unit_price_override == null
        ? null
        : toMoney(current?.unit_price_override);
  if (unitPriceOverride?.error) return unitPriceOverride;
  return {
    studentId,
    feeItemTemplateId,
    startDate,
    endDate,
    status,
    quantityOverride,
    unitPriceOverride,
    note: body.note !== undefined ? String(body.note ?? "").trim() : current?.note ?? "",
  };
}

async function replacePolicyStudents(client, policyId, studentIds) {
  await client.query(`DELETE FROM discount_policy_students WHERE policy_id = $1`, [policyId]);
  for (const studentId of normalizePositiveIntArray(studentIds)) {
    await client.query(
      `INSERT INTO discount_policy_students (policy_id, student_id) VALUES ($1, $2)`,
      [policyId, studentId]
    );
  }
}

async function replacePeriodItems(client, periodId, items) {
  await client.query(`DELETE FROM fee_period_items WHERE period_id = $1`, [periodId]);
  for (let index = 0; index < items.length; index++) {
    const item = items[index] || {};
    const code = normalizeCode(item.code);
    if (code?.error) throw new Error(code.error);
    const name = normalizeText(item.name, `items[${index}].name`);
    if (name?.error) throw new Error(name.error);
    const category = normalizeEnum(item.category, ITEM_CATEGORIES, `items[${index}].category`, "fixed");
    if (category?.error) throw new Error(category.error);
    const calcType = normalizeEnum(item.calcType, ITEM_CALC_TYPES, `items[${index}].calcType`, "monthly_fixed");
    if (calcType?.error) throw new Error(calcType.error);
    const billingCycle = normalizeEnum(item.billingCycle, BILLING_CYCLES, `items[${index}].billingCycle`, "monthly");
    if (billingCycle?.error) throw new Error(billingCycle.error);
    const amount = normalizeMoney(item.amount ?? 0, `items[${index}].amount`);
    if (amount?.error) throw new Error(amount.error);
    const chargeTiming = normalizeEnum(item.chargeTiming, CHARGE_TIMINGS, `items[${index}].chargeTiming`, "advance");
    if (chargeTiming?.error) throw new Error(chargeTiming.error);
    const quantityMode = normalizeEnum(item.quantityMode, QUANTITY_MODES, `items[${index}].quantityMode`, "fixed");
    if (quantityMode?.error) throw new Error(quantityMode.error);
    const unitPrice = normalizeMoney(item.unitPrice ?? amount, `items[${index}].unitPrice`);
    if (unitPrice?.error) throw new Error(unitPrice.error);
    const unitName = normalizeText(item.unitName ?? "tháng", `items[${index}].unitName`);
    if (unitName?.error) throw new Error(unitName.error);
    const fixedQuantity = normalizeMoney(item.fixedQuantity ?? 1, `items[${index}].fixedQuantity`);
    if (fixedQuantity?.error) throw new Error(fixedQuantity.error);
    const formulaType = normalizeEnum(
      item.formulaType,
      FORMULA_TYPES,
      `items[${index}].formulaType`,
      quantityMode === "actual_days" ? "actual_days_x_price" : "fixed_x_price_x_frequency"
    );
    if (formulaType?.error) throw new Error(formulaType.error);
    const frequencyMultiplier = normalizeMoney(item.frequencyMultiplier ?? 1, `items[${index}].frequencyMultiplier`);
    if (frequencyMultiplier?.error) throw new Error(frequencyMultiplier.error);
    const chargeWeekdays = normalizeWeekdays(item.chargeWeekdays ?? [1, 2, 3, 4, 5, 6]);
    if (chargeWeekdays?.error) throw new Error(chargeWeekdays.error);
    const scopeType = normalizeEnum(item.scopeType, SCOPE_TYPES, `items[${index}].scopeType`, "all");
    if (scopeType?.error) throw new Error(scopeType.error);
    const prorationMode = normalizeEnum(item.prorationMode, PRORATION_MODES, `items[${index}].prorationMode`, "full_month");
    if (prorationMode?.error) throw new Error(prorationMode.error);
    const applyLevels = normalizeStringArray(item.applyLevels);
    const applyClassIds = normalizePositiveIntArray(item.applyClassIds);

    await client.query(
      `INSERT INTO fee_period_items
       (period_id, template_id, code, name, category, calc_type, billing_cycle, description, amount, charge_timing,
        quantity_mode, unit_price, unit_name, fixed_quantity, formula_type, frequency_multiplier, charge_weekdays,
        is_optional, sort_order, scope_type, apply_levels, apply_class_ids, proration_mode)
       VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23)`,
      [
        periodId,
        Number(item.templateId) || null,
        code,
        name,
        category,
        calcType,
        billingCycle,
        String(item.description ?? "").trim(),
        amount,
        chargeTiming,
        quantityMode,
        unitPrice,
        unitName,
        fixedQuantity,
        formulaType,
        frequencyMultiplier,
        chargeWeekdays.join(","),
        Boolean(item.isOptional),
        Number(item.sortOrder ?? index + 1) || index + 1,
        scopeType,
        applyLevels.join(","),
        applyClassIds.join(","),
        prorationMode,
      ]
    );
  }
}

function templateAppliesToStudent(item, student, monthKey) {
  if (!monthInRange(monthKey, item.effectiveStartMonth || item.effective_start_month, item.effectiveEndMonth || item.effective_end_month)) {
    return false;
  }
  const scopeType = item.scopeType ?? item.scope_type ?? "all";
  const levels = item.applyLevels ?? csvToStringList(item.apply_levels);
  const classIds = item.applyClassIds ?? csvToNumberList(item.apply_class_ids);
  if (scopeType === "levels" && levels.length) {
    return levels.includes(String(student.class_level ?? "").trim());
  }
  if (scopeType === "classes" && classIds.length) {
    return classIds.includes(Number(student.class_id));
  }
  return true;
}

function buildChargeLine({
  feePeriodItemId,
  code,
  name,
  category,
  calcType,
  quantity,
  unitPrice,
  baseAmount,
  finalAmount,
  formulaText,
  note,
  sourceType,
  sourceReference,
  isOptional,
  sortOrder,
  lineType = "charge",
}) {
  return {
    feePeriodItemId: feePeriodItemId ?? null,
    code: code ?? "",
    name,
    category: category ?? "fixed",
    calcType: calcType ?? "monthly_fixed",
    quantity: roundMoney(quantity),
    unitPrice: roundMoney(unitPrice),
    baseAmount: roundMoney(baseAmount),
    discountAmount: 0,
    finalAmount: roundMoney(finalAmount),
    formulaText: formulaText ?? "",
    note: note ?? "",
    sourceType: sourceType ?? "SystemRule",
    sourceReference: sourceReference ?? "",
    isOptional: Boolean(isOptional),
    sortOrder: Number(sortOrder ?? 0),
    lineType,
  };
}

function buildPeriodLineFromAdjustment(adjustment, sortOrder = 1000) {
  const amount = toMoney(adjustment.amount);
  return buildChargeLine({
    code: adjustment.item_code ?? "",
    name: adjustment.line_name,
    category: "adjustment",
    calcType: "manual",
    quantity: toMoney(adjustment.quantity || 1),
    unitPrice: toMoney(adjustment.unit_price || Math.abs(amount)),
    baseAmount: amount,
    finalAmount: amount,
    formulaText: adjustment.quantity && adjustment.unit_price ? `${toMoney(adjustment.unit_price)} x ${toMoney(adjustment.quantity)}` : "",
    note: adjustment.note ?? "",
    sourceType: adjustment.source_type ?? "Adjustment",
    sourceReference: `adjustment:${adjustment.id}`,
    isOptional: false,
    sortOrder,
    lineType: "adjustment",
  });
}

function calculateItemForStudent(item, student, ctx) {
  if (!templateAppliesToStudent(item, student, ctx.monthKey)) return null;

  const weekdays = item.chargeWeekdays ?? [1, 2, 3, 4, 5, 6];
  const unitPrice = toMoney(item.unitPrice);
  const fixedQuantity = toMoney(item.fixedQuantity || 1);
  const frequencyMultiplier = toMoney(item.frequencyMultiplier || 1) || 1;
  const studentRange = [student.join_date, student.leave_date];

  if (item.category === "service") {
    const serviceKey = `${student.id}:${item.templateId || 0}:${item.code}`;
    const service = ctx.subscriptionMap.get(serviceKey);
    if (!service || service.status !== "active") return null;

    if (item.calcType === "service_usage") {
      const usageQuantity = toMoney(service.usage_quantity || 0);
      if (usageQuantity <= 0) return null;
      const price = service.unit_price_override == null ? unitPrice : toMoney(service.unit_price_override);
      return buildChargeLine({
        feePeriodItemId: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        calcType: item.calcType,
        quantity: usageQuantity,
        unitPrice: price,
        baseAmount: usageQuantity * price,
        finalAmount: usageQuantity * price,
        formulaText: `${price} x ${usageQuantity}`,
        note: `${usageQuantity} đơn vị dịch vụ từ đăng ký tháng ${ctx.monthKey}`,
        sourceType: "ServiceRegistration",
        sourceReference: `subscription:${service.id}`,
        isOptional: item.isOptional,
        sortOrder: item.sortOrder,
      });
    }

    const serviceRange = [service.start_date, service.end_date];
    const factor = computeProrationFactor(item.prorationMode, ctx.monthKey, weekdays, studentRange, serviceRange);
    if (factor <= 0) return null;
    const quantity = service.quantity_override == null ? fixedQuantity : toMoney(service.quantity_override);
    const price = service.unit_price_override == null ? unitPrice : toMoney(service.unit_price_override);
    const amount = quantity * price * frequencyMultiplier;
    return buildChargeLine({
      feePeriodItemId: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      calcType: item.calcType,
      quantity,
      unitPrice: price,
      baseAmount: amount,
      finalAmount: amount * factor,
      formulaText: formatFormula([
        `${price} x ${quantity}`,
        frequencyMultiplier !== 1 ? `tần suất ${frequencyMultiplier}` : "",
        factor !== 1 ? `tỷ lệ ${Math.round(factor * 100)}%` : "",
      ]),
      note: factor !== 1 ? "Đã prorate theo thời gian sử dụng dịch vụ trong tháng" : "Dịch vụ đăng ký theo tháng",
      sourceType: "ServiceRegistration",
      sourceReference: `subscription:${service.id}`,
      isOptional: item.isOptional,
      sortOrder: item.sortOrder,
    });
  }

  if (item.calcType === "attendance_days" || item.calcType === "meal_days") {
    const quantity = toMoney(ctx.attendanceMap.get(student.id) || 0);
    if (quantity <= 0) return null;
    return buildChargeLine({
      feePeriodItemId: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      calcType: item.calcType,
      quantity,
      unitPrice,
      baseAmount: quantity * unitPrice,
      finalAmount: quantity * unitPrice,
      formulaText: `${unitPrice} x ${quantity}`,
      note: item.calcType === "meal_days" ? `${quantity} ngày ăn lấy từ điểm danh chuyên cần` : `${quantity} ngày học thực tế lấy từ điểm danh`,
      sourceType: item.calcType === "meal_days" ? "Meal" : "Attendance",
      sourceReference: `month:${ctx.monthKey}`,
      isOptional: item.isOptional,
      sortOrder: item.sortOrder,
    });
  }

  if (item.calcType === "one_time") {
    const quantity = fixedQuantity || 1;
    return buildChargeLine({
      feePeriodItemId: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      calcType: item.calcType,
      quantity,
      unitPrice,
      baseAmount: quantity * unitPrice,
      finalAmount: quantity * unitPrice,
      formulaText: `${unitPrice} x ${quantity}`,
      note: "Khoản thu một lần trong kỳ",
      sourceType: "SystemRule",
      sourceReference: `period:${ctx.periodId}`,
      isOptional: item.isOptional,
      sortOrder: item.sortOrder,
    });
  }

  if (item.calcType === "manual") return null;

  const factor = computeProrationFactor(item.prorationMode, ctx.monthKey, weekdays, studentRange);
  if (factor <= 0) return null;
  const quantity = fixedQuantity || 1;
  const multiplier = item.formulaType === "fixed_x_price_x_frequency" ? frequencyMultiplier : 1;
  const amount = quantity * unitPrice * multiplier;
  return buildChargeLine({
    feePeriodItemId: item.id,
    code: item.code,
    name: item.name,
    category: item.category,
    calcType: item.calcType,
    quantity,
    unitPrice,
    baseAmount: amount,
    finalAmount: amount * factor,
    formulaText: formatFormula([
      `${unitPrice} x ${quantity}`,
      multiplier !== 1 ? `tần suất ${multiplier}` : "",
      factor !== 1 ? `tỷ lệ ${Math.round(factor * 100)}%` : "",
    ]),
    note: factor !== 1 ? "Khoản cố định đã được prorate theo thời gian học trong tháng" : "Khoản cố định theo tháng",
    sourceType: "SystemRule",
    sourceReference: `period:${ctx.periodId}`,
    isOptional: item.isOptional,
    sortOrder: item.sortOrder,
  });
}

function buildDiscountLines(studentId, lines, policies) {
  const discountLines = [];
  const appliedPolicies = [];
  const positiveLines = lines.filter((line) => line.finalAmount > 0 && line.lineType === "charge");

  for (const policy of policies.filter((row) => Number(row.student_id) === Number(studentId))) {
    let eligibleLines = positiveLines;
    if (policy.apply_scope === "item_category" && policy.target_category) {
      eligibleLines = positiveLines.filter((line) => line.category === policy.target_category);
    } else if (policy.apply_scope === "item_code" && policy.target_fee_item_code) {
      eligibleLines = positiveLines.filter((line) => line.code === policy.target_fee_item_code);
    }
    const eligibleAmount = eligibleLines.reduce((sum, line) => sum + toMoney(line.finalAmount), 0);
    if (eligibleAmount <= 0) continue;

    let discountAmount =
      policy.discount_type === "percent"
        ? roundMoney((eligibleAmount * toMoney(policy.discount_value)) / 100)
        : toMoney(policy.discount_value);
    discountAmount = Math.min(discountAmount, eligibleAmount);
    if (discountAmount <= 0) continue;

    discountLines.push(
      buildChargeLine({
        code: policy.target_fee_item_code || "DISCOUNT",
        name: policy.name,
        category: "adjustment",
        calcType: "manual",
        quantity: 1,
        unitPrice: discountAmount,
        baseAmount: -discountAmount,
        finalAmount: -discountAmount,
        formulaText:
          policy.discount_type === "percent"
            ? `${policy.discount_value}% trên ${eligibleAmount}`
            : `Giảm cố định ${discountAmount}`,
        note: policy.note || "Miễn giảm áp dụng theo chính sách",
        sourceType: "SystemRule",
        sourceReference: `policy:${policy.id}`,
        isOptional: false,
        sortOrder: 950 + discountLines.length,
        lineType: "discount",
      })
    );
    appliedPolicies.push({
      policyId: policy.id,
      policyName: policy.name,
      discountType: policy.discount_type,
      discountValue: toMoney(policy.discount_value),
      discountAmount,
    });
  }

  return { discountLines, appliedPolicies };
}

function summarizeStatementLines(lines) {
  const baseAmount = roundMoney(lines.filter((line) => line.finalAmount > 0).reduce((sum, line) => sum + toMoney(line.finalAmount), 0));
  const discountAmount = roundMoney(
    lines.filter((line) => line.finalAmount < 0).reduce((sum, line) => sum + Math.abs(toMoney(line.finalAmount)), 0)
  );
  const previousBalance = roundMoney(
    lines
      .filter((line) => line.lineType === "balance" || line.lineType === "credit")
      .reduce((sum, line) => sum + toMoney(line.finalAmount), 0)
  );
  const adjustmentAmount = roundMoney(
    lines.filter((line) => line.lineType === "adjustment").reduce((sum, line) => sum + toMoney(line.finalAmount), 0)
  );
  const finalAmount = roundMoney(lines.reduce((sum, line) => sum + toMoney(line.finalAmount), 0));
  return { baseAmount, discountAmount, previousBalance, adjustmentAmount, finalAmount };
}

async function insertStudentStatementLine(client, studentFeePeriodId, line) {
  await client.query(
    `INSERT INTO student_fee_period_items
     (student_fee_period_id, fee_period_item_id, item_name, item_code, line_type, category, calc_type,
      quantity, unit_price, base_amount, discount_amount, final_amount, formula_text, note, source_type,
      source_reference, is_optional, sort_order)
     VALUES
     ($1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18)`,
    [
      studentFeePeriodId,
      line.feePeriodItemId,
      line.name,
      line.code ?? "",
      line.lineType,
      line.category,
      line.calcType,
      line.quantity,
      line.unitPrice,
      line.baseAmount,
      line.discountAmount ?? 0,
      line.finalAmount,
      line.formulaText ?? "",
      line.note ?? "",
      line.sourceType ?? "SystemRule",
      line.sourceReference ?? "",
      Boolean(line.isOptional),
      Number(line.sortOrder ?? 0),
    ]
  );
}

async function recalcStudentPeriodTotals(client, studentFeePeriodId) {
  const linesRes = await client.query(
    `SELECT line_type, final_amount FROM student_fee_period_items WHERE student_fee_period_id = $1`,
    [studentFeePeriodId]
  );
  const lines = linesRes.rows.map((row) => ({ lineType: row.line_type, finalAmount: toMoney(row.final_amount) }));
  const totals = summarizeStatementLines(lines);
  const currentRes = await client.query(`SELECT paid_amount FROM student_fee_periods WHERE id = $1 FOR UPDATE`, [studentFeePeriodId]);
  if (!currentRes.rowCount) return null;
  const paidAmount = toMoney(currentRes.rows[0].paid_amount);
  const nextStatus =
    totals.finalAmount <= 0 ? "paid" : paidAmount <= 0 ? "unpaid" : paidAmount >= totals.finalAmount ? "paid" : "partial";

  await client.query(
    `UPDATE student_fee_periods
     SET base_amount = $1,
         previous_balance = $2,
         adjustment_amount = $3,
         discount_amount = $4,
         final_amount = $5,
         payment_status = $6,
         updated_at = NOW()
     WHERE id = $7`,
    [totals.baseAmount, totals.previousBalance, totals.adjustmentAmount, totals.discountAmount, totals.finalAmount, nextStatus, studentFeePeriodId]
  );
  return { ...totals, paidAmount, paymentStatus: nextStatus };
}

async function fetchPeriodGeneratedState(client, periodId) {
  const paymentExists = await client.query(
    `SELECT 1
     FROM fee_payments fp
     JOIN student_fee_periods sfp ON sfp.id = fp.student_fee_period_id
     WHERE sfp.period_id = $1
     LIMIT 1`,
    [periodId]
  );
  return { hasPayments: paymentExists.rowCount > 0 };
}

router.get("/item-templates", async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.active !== undefined && req.query.active !== "") {
      params.push(String(req.query.active).trim().toLowerCase() === "true");
      where.push(`active = $${params.length}`);
    }
    if (req.query.category) {
      params.push(String(req.query.category).trim().toLowerCase());
      where.push(`category = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    const result = await pool.query(
      `SELECT *
       FROM fee_item_templates
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY sort_order, id`,
      params
    );
    res.json(result.rows.map(mapTemplateRow));
  } catch (e) {
    next(e);
  }
});

router.post("/item-templates", async (req, res, next) => {
  try {
    const values = buildTemplateValues(req.body || {});
    if (values?.error) return res.status(400).json({ error: values.error });
    const result = await pool.query(
      `INSERT INTO fee_item_templates
       (code, name, category, calc_type, billing_cycle, description, default_amount, charge_timing, quantity_mode,
        unit_price, unit_name, fixed_quantity, formula_type, frequency_multiplier, charge_weekdays, is_optional,
        sort_order, active, effective_start_month, effective_end_month, scope_type, apply_levels, apply_class_ids,
        proration_mode, updated_at)
       VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23,
        $24, NOW())
       RETURNING *`,
      [
        values.code,
        values.name,
        values.category,
        values.calcType,
        values.billingCycle,
        values.description,
        values.defaultAmount,
        values.chargeTiming,
        values.quantityMode,
        values.unitPrice,
        values.unitName,
        values.fixedQuantity,
        values.formulaType,
        values.frequencyMultiplier,
        values.chargeWeekdays.join(","),
        values.isOptional,
        values.sortOrder,
        values.active,
        values.effectiveStartMonth,
        values.effectiveEndMonth,
        values.scopeType,
        values.applyLevels.join(","),
        values.applyClassIds.join(","),
        values.prorationMode,
      ]
    );
    res.status(201).json(mapTemplateRow(result.rows[0]));
  } catch (e) {
    if (String(e.message || "").includes("idx_fee_item_templates_code_unique")) {
      return res.status(400).json({ error: "Mã khoản thu đã tồn tại" });
    }
    if (String(e.message || "").includes("fee_item_templates_name_key")) {
      return res.status(400).json({ error: "Tên khoản thu đã tồn tại" });
    }
    next(e);
  }
});

router.put("/item-templates/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const current = await pool.query(`SELECT * FROM fee_item_templates WHERE id = $1`, [id]);
    if (!current.rowCount) return res.status(404).json({ error: "Fee item template not found" });
    const values = buildTemplateValues(req.body || {}, current.rows[0]);
    if (values?.error) return res.status(400).json({ error: values.error });
    const result = await pool.query(
      `UPDATE fee_item_templates
       SET code = $1, name = $2, category = $3, calc_type = $4, billing_cycle = $5, description = $6,
           default_amount = $7, charge_timing = $8, quantity_mode = $9, unit_price = $10, unit_name = $11,
           fixed_quantity = $12, formula_type = $13, frequency_multiplier = $14, charge_weekdays = $15,
           is_optional = $16, sort_order = $17, active = $18, effective_start_month = $19, effective_end_month = $20,
           scope_type = $21, apply_levels = $22, apply_class_ids = $23, proration_mode = $24, updated_at = NOW()
       WHERE id = $25
       RETURNING *`,
      [
        values.code,
        values.name,
        values.category,
        values.calcType,
        values.billingCycle,
        values.description,
        values.defaultAmount,
        values.chargeTiming,
        values.quantityMode,
        values.unitPrice,
        values.unitName,
        values.fixedQuantity,
        values.formulaType,
        values.frequencyMultiplier,
        values.chargeWeekdays.join(","),
        values.isOptional,
        values.sortOrder,
        values.active,
        values.effectiveStartMonth,
        values.effectiveEndMonth,
        values.scopeType,
        values.applyLevels.join(","),
        values.applyClassIds.join(","),
        values.prorationMode,
        id,
      ]
    );
    res.json(mapTemplateRow(result.rows[0]));
  } catch (e) {
    if (String(e.message || "").includes("idx_fee_item_templates_code_unique")) {
      return res.status(400).json({ error: "Mã khoản thu đã tồn tại" });
    }
    if (String(e.message || "").includes("fee_item_templates_name_key")) {
      return res.status(400).json({ error: "Tên khoản thu đã tồn tại" });
    }
    next(e);
  }
});

router.get("/periods", async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.monthKey) {
      const monthKey = normalizeMonthKey(req.query.monthKey, "monthKey");
      if (monthKey?.error) return res.status(400).json({ error: monthKey.error });
      params.push(monthKey);
      where.push(`p.month_key = $${params.length}`);
    }
    if (req.query.status) {
      const status = normalizeEnum(req.query.status, PERIOD_STATUSES, "status", "draft");
      if (status?.error) return res.status(400).json({ error: status.error });
      params.push(status);
      where.push(`p.status = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`p.title ILIKE $${params.length}`);
    }
    const result = await pool.query(
      `SELECT p.*,
              COUNT(DISTINCT i.id) AS item_count,
              COUNT(DISTINCT sfp.id) AS student_count,
              COALESCE(SUM(sfp.final_amount), 0) AS total_final_amount,
              COALESCE(SUM(sfp.paid_amount), 0) AS total_paid_amount
       FROM fee_periods p
       LEFT JOIN fee_period_items i ON i.period_id = p.id
       LEFT JOIN student_fee_periods sfp ON sfp.period_id = p.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       GROUP BY p.id
       ORDER BY p.month_key DESC, p.id DESC`,
      params
    );
    res.json(result.rows.map(mapPeriodRow));
  } catch (e) {
    next(e);
  }
});

router.get("/periods/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const periodRes = await pool.query(
      `SELECT p.*,
              COUNT(DISTINCT i.id) AS item_count,
              COUNT(DISTINCT sfp.id) AS student_count,
              COALESCE(SUM(sfp.final_amount), 0) AS total_final_amount,
              COALESCE(SUM(sfp.paid_amount), 0) AS total_paid_amount
       FROM fee_periods p
       LEFT JOIN fee_period_items i ON i.period_id = p.id
       LEFT JOIN student_fee_periods sfp ON sfp.period_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    if (!periodRes.rowCount) return res.status(404).json({ error: "Fee period not found" });
    const itemsRes = await pool.query(`SELECT * FROM fee_period_items WHERE period_id = $1 ORDER BY sort_order, id`, [id]);
    res.json({ ...mapPeriodRow(periodRes.rows[0]), items: itemsRes.rows.map(mapPeriodItemRow) });
  } catch (e) {
    next(e);
  }
});

router.post("/periods", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const monthKey = normalizeMonthKey(body.monthKey, "monthKey");
    if (monthKey?.error) return res.status(400).json({ error: monthKey.error });
    const dueDate = normalizeOptionalDate(body.dueDate, "dueDate");
    if (dueDate?.error) return res.status(400).json({ error: dueDate.error });
    const status = normalizeEnum(body.status ?? "draft", PERIOD_STATUSES, "status", "draft");
    if (status?.error) return res.status(400).json({ error: status.error });
    const title = String(body.title ?? "").trim() || `Học phí tháng ${monthKey}`;
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: "Kỳ thu phải có ít nhất một khoản thu" });
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO fee_periods (month_key, title, due_date, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [monthKey, title, dueDate, status, req.user.id]
    );
    await replacePeriodItems(client, inserted.rows[0].id, items);
    await client.query("COMMIT");
    const fresh = await pool.query(
      `SELECT p.*, COUNT(DISTINCT i.id) AS item_count, 0::bigint AS student_count, 0::numeric AS total_final_amount, 0::numeric AS total_paid_amount
       FROM fee_periods p
       LEFT JOIN fee_period_items i ON i.period_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [inserted.rows[0].id]
    );
    res.status(201).json(mapPeriodRow(fresh.rows[0]));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (String(e.message || "").includes("fee_periods_month_key_key")) {
      return res.status(400).json({ error: "Tháng này đã có kỳ thu" });
    }
    next(e);
  } finally {
    client.release();
  }
});

router.put("/periods/:id", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const current = await client.query(`SELECT * FROM fee_periods WHERE id = $1`, [id]);
    if (!current.rowCount) return res.status(404).json({ error: "Fee period not found" });
    const existing = current.rows[0];
    const generatedState = await fetchPeriodGeneratedState(client, id);
    if (generatedState.hasPayments) {
      return res.status(400).json({ error: "Kỳ thu đã có thanh toán, không thể sửa trực tiếp" });
    }
    const monthKey =
      req.body?.monthKey !== undefined ? normalizeMonthKey(req.body.monthKey, "monthKey") : existing.month_key;
    if (monthKey?.error) return res.status(400).json({ error: monthKey.error });
    const dueDate =
      req.body?.dueDate !== undefined ? normalizeOptionalDate(req.body.dueDate, "dueDate") : existing.due_date;
    if (dueDate?.error) return res.status(400).json({ error: dueDate.error });
    const status =
      req.body?.status !== undefined ? normalizeEnum(req.body.status, PERIOD_STATUSES, "status", "draft") : existing.status;
    if (status?.error) return res.status(400).json({ error: status.error });
    const title = req.body?.title !== undefined ? String(req.body.title ?? "").trim() || `Học phí tháng ${monthKey}` : existing.title;
    const items = req.body?.items !== undefined ? req.body.items : null;
    await client.query("BEGIN");
    await client.query(
      `UPDATE fee_periods SET month_key = $1, title = $2, due_date = $3, status = $4, updated_at = NOW() WHERE id = $5`,
      [monthKey, title, dueDate, status, id]
    );
    if (Array.isArray(items)) {
      if (!items.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Kỳ thu phải có ít nhất một khoản thu" });
      }
      await replacePeriodItems(client, id, items);
      await client.query(`DELETE FROM student_fee_periods WHERE period_id = $1`, [id]);
    }
    await client.query("COMMIT");
    const fresh = await pool.query(
      `SELECT p.*,
              COUNT(DISTINCT i.id) AS item_count,
              COUNT(DISTINCT sfp.id) AS student_count,
              COALESCE(SUM(sfp.final_amount), 0) AS total_final_amount,
              COALESCE(SUM(sfp.paid_amount), 0) AS total_paid_amount
       FROM fee_periods p
       LEFT JOIN fee_period_items i ON i.period_id = p.id
       LEFT JOIN student_fee_periods sfp ON sfp.period_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    res.json(mapPeriodRow(fresh.rows[0]));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (String(e.message || "").includes("fee_periods_month_key_key")) {
      return res.status(400).json({ error: "Tháng này đã có kỳ thu" });
    }
    next(e);
  } finally {
    client.release();
  }
});

router.get("/discount-policies", async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.active !== undefined && req.query.active !== "") {
      params.push(String(req.query.active).trim().toLowerCase() === "true");
      where.push(`p.active = $${params.length}`);
    }
    if (req.query.discountType) {
      params.push(String(req.query.discountType).trim().toLowerCase());
      where.push(`p.discount_type = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`p.name ILIKE $${params.length}`);
    }
    const result = await pool.query(
      `SELECT p.*, COUNT(ps.id) AS student_count
       FROM discount_policies p
       LEFT JOIN discount_policy_students ps ON ps.policy_id = p.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       GROUP BY p.id
       ORDER BY p.active DESC, p.start_month DESC, p.id DESC`,
      params
    );
    res.json(result.rows.map(mapPolicyRow));
  } catch (e) {
    next(e);
  }
});

router.get("/discount-policies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const policyRes = await pool.query(`SELECT * FROM discount_policies WHERE id = $1`, [id]);
    if (!policyRes.rowCount) return res.status(404).json({ error: "Discount policy not found" });
    const studentsRes = await pool.query(
      `SELECT ps.student_id, s.name AS student_name, s.class_id, c.name AS class_name
       FROM discount_policy_students ps
       JOIN students s ON s.id = ps.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE ps.policy_id = $1
       ORDER BY s.name`,
      [id]
    );
    res.json({
      ...mapPolicyRow({ ...policyRes.rows[0], student_count: studentsRes.rowCount }),
      students: studentsRes.rows.map((row) => ({
        studentId: row.student_id,
        studentName: row.student_name,
        classId: row.class_id,
        className: row.class_name ?? "",
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/discount-policies", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const values = buildPolicyValues(req.body || {});
    if (values?.error) return res.status(400).json({ error: values.error });
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO discount_policies
       (name, discount_type, discount_value, apply_scope, target_category, target_fee_item_code,
        start_month, end_month, active, note, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        values.name,
        values.discountType,
        values.discountValue,
        values.applyScope,
        values.targetCategory,
        values.targetFeeItemCode,
        values.startMonth,
        values.endMonth || null,
        values.active,
        values.note,
        req.user.id,
      ]
    );
    await replacePolicyStudents(client, inserted.rows[0].id, values.studentIds);
    await client.query("COMMIT");
    res.status(201).json(mapPolicyRow({ ...inserted.rows[0], student_count: values.studentIds.length }));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.put("/discount-policies/:id", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const current = await client.query(`SELECT * FROM discount_policies WHERE id = $1`, [id]);
    if (!current.rowCount) return res.status(404).json({ error: "Discount policy not found" });
    const values = buildPolicyValues(req.body || {}, current.rows[0]);
    if (values?.error) return res.status(400).json({ error: values.error });
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE discount_policies
       SET name = $1, discount_type = $2, discount_value = $3, apply_scope = $4,
           target_category = $5, target_fee_item_code = $6, start_month = $7, end_month = $8,
           active = $9, note = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        values.name,
        values.discountType,
        values.discountValue,
        values.applyScope,
        values.targetCategory,
        values.targetFeeItemCode,
        values.startMonth,
        values.endMonth || null,
        values.active,
        values.note,
        id,
      ]
    );
    if (req.body?.studentIds !== undefined) {
      await replacePolicyStudents(client, id, values.studentIds);
    }
    await client.query("COMMIT");
    res.json(mapPolicyRow({ ...updated.rows[0], student_count: values.studentIds.length }));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.get("/service-subscriptions", async (req, res, next) => {
  try {
    const where = [`fit.category = 'service'`];
    const params = [];
    if (req.query.studentId) {
      params.push(Number(req.query.studentId));
      where.push(`sss.student_id = $${params.length}`);
    }
    if (req.query.classId) {
      params.push(Number(req.query.classId));
      where.push(`s.class_id = $${params.length}`);
    }
    if (req.query.templateId) {
      params.push(Number(req.query.templateId));
      where.push(`sss.fee_item_template_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(String(req.query.status).trim().toLowerCase());
      where.push(`sss.status = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`(s.name ILIKE $${params.length} OR fit.name ILIKE $${params.length})`);
    }
    const monthKey =
      req.query.monthKey && String(req.query.monthKey).trim() !== ""
        ? normalizeMonthKey(req.query.monthKey, "monthKey")
        : null;
    if (monthKey?.error) return res.status(400).json({ error: monthKey.error });
    if (monthKey) params.push(monthKey);

    const result = await pool.query(
      `SELECT sss.*, s.name AS student_name, s.class_id, c.name AS class_name,
              fit.code AS fee_item_code, fit.name AS fee_item_name,
              su.month_key AS usage_month_key, su.quantity AS usage_quantity
       FROM student_service_subscriptions sss
       JOIN students s ON s.id = sss.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_item_templates fit ON fit.id = sss.fee_item_template_id
       LEFT JOIN student_service_usage_entries su
         ON su.subscription_id = sss.id
        ${monthKey ? `AND su.month_key = $${params.length}` : ""}
       WHERE ${where.join(" AND ")}
       ORDER BY s.name, fit.name, sss.id`,
      params
    );
    res.json(result.rows.map(mapServiceRow));
  } catch (e) {
    next(e);
  }
});

router.get("/service-subscriptions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const detail = await pool.query(
      `SELECT sss.*, s.name AS student_name, s.class_id, c.name AS class_name,
              fit.code AS fee_item_code, fit.name AS fee_item_name
       FROM student_service_subscriptions sss
       JOIN students s ON s.id = sss.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_item_templates fit ON fit.id = sss.fee_item_template_id
       WHERE sss.id = $1`,
      [id]
    );
    if (!detail.rowCount) return res.status(404).json({ error: "Service subscription not found" });
    const usage = await pool.query(
      `SELECT * FROM student_service_usage_entries WHERE subscription_id = $1 ORDER BY month_key DESC`,
      [id]
    );
    res.json({
      ...mapServiceRow(detail.rows[0]),
      usages: usage.rows.map((row) => ({
        id: row.id,
        monthKey: row.month_key,
        quantity: toMoney(row.quantity),
        note: row.note ?? "",
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/service-subscriptions", async (req, res, next) => {
  try {
    const values = buildServiceValues(req.body || {});
    if (values?.error) return res.status(400).json({ error: values.error });
    const result = await pool.query(
      `INSERT INTO student_service_subscriptions
       (student_id, fee_item_template_id, start_date, end_date, status, quantity_override, unit_price_override, note, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        values.studentId,
        values.feeItemTemplateId,
        values.startDate,
        values.endDate,
        values.status,
        values.quantityOverride,
        values.unitPriceOverride,
        values.note,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.put("/service-subscriptions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const current = await pool.query(`SELECT * FROM student_service_subscriptions WHERE id = $1`, [id]);
    if (!current.rowCount) return res.status(404).json({ error: "Service subscription not found" });
    const values = buildServiceValues(req.body || {}, current.rows[0]);
    if (values?.error) return res.status(400).json({ error: values.error });
    const result = await pool.query(
      `UPDATE student_service_subscriptions
       SET student_id = $1, fee_item_template_id = $2, start_date = $3, end_date = $4, status = $5,
           quantity_override = $6, unit_price_override = $7, note = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        values.studentId,
        values.feeItemTemplateId,
        values.startDate,
        values.endDate,
        values.status,
        values.quantityOverride,
        values.unitPriceOverride,
        values.note,
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.put("/service-subscriptions/:id/usage", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const current = await pool.query(`SELECT * FROM student_service_subscriptions WHERE id = $1`, [id]);
    if (!current.rowCount) return res.status(404).json({ error: "Service subscription not found" });
    const monthKey = normalizeMonthKey(req.body?.monthKey, "monthKey");
    if (monthKey?.error) return res.status(400).json({ error: monthKey.error });
    const quantity = normalizeMoney(req.body?.quantity ?? 0, "quantity");
    if (quantity?.error) return res.status(400).json({ error: quantity.error });
    const note = String(req.body?.note ?? "").trim();
    const result = await pool.query(
      `INSERT INTO student_service_usage_entries (subscription_id, month_key, quantity, note, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (subscription_id, month_key)
       DO UPDATE SET quantity = EXCLUDED.quantity, note = EXCLUDED.note, updated_at = NOW()
       RETURNING *`,
      [id, monthKey, quantity, note]
    );
    res.json({
      id: result.rows[0].id,
      monthKey: result.rows[0].month_key,
      quantity: toMoney(result.rows[0].quantity),
      note: result.rows[0].note ?? "",
    });
  } catch (e) {
    next(e);
  }
});

router.post("/periods/:id/generate", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const periodId = Number(req.params.id);
    const periodRes = await client.query(`SELECT * FROM fee_periods WHERE id = $1`, [periodId]);
    if (!periodRes.rowCount) return res.status(404).json({ error: "Fee period not found" });
    const period = periodRes.rows[0];
    const itemsRes = await client.query(`SELECT * FROM fee_period_items WHERE period_id = $1 ORDER BY sort_order, id`, [periodId]);
    if (!itemsRes.rowCount) return res.status(400).json({ error: "Kỳ thu phải có ít nhất một khoản thu trước khi generate" });
    const items = itemsRes.rows.map(mapPeriodItemRow);

    await client.query("BEGIN");
    const state = await fetchPeriodGeneratedState(client, periodId);
    if (state.hasPayments) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Kỳ thu đã có thanh toán, không thể generate lại" });
    }
    await client.query(`DELETE FROM student_fee_periods WHERE period_id = $1`, [periodId]);

    const { start, end } = monthBounds(period.month_key);
    const monthStart = dateOnly(start);
    const monthEnd = dateOnly(end);

    const studentsRes = await client.query(
      `SELECT s.id, s.name, s.class_id, s.join_date, s.leave_date, s.status,
              c.name AS class_name, c.level AS class_level
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.status IN ('active', 'inactive')
         AND COALESCE(s.join_date, $1::date) <= $2::date
         AND (s.leave_date IS NULL OR s.leave_date >= $1::date)
       ORDER BY c.name NULLS LAST, s.name`,
      [monthStart, monthEnd]
    );
    const attendanceRes = await client.query(
      `SELECT student_id, COUNT(DISTINCT attendance_date) AS attendance_days
       FROM student_attendance
       WHERE attendance_date >= $1::date
         AND attendance_date <= $2::date
         AND status = 'present'
       GROUP BY student_id`,
      [monthStart, monthEnd]
    );
    const attendanceMap = new Map(attendanceRes.rows.map((row) => [Number(row.student_id), Number(row.attendance_days || 0)]));

    const policyRes = await client.query(
      `SELECT p.*, ps.student_id
       FROM discount_policies p
       JOIN discount_policy_students ps ON ps.policy_id = p.id
       WHERE p.active = TRUE
         AND p.start_month <= $1
         AND (p.end_month IS NULL OR p.end_month = '' OR p.end_month >= $1)
       ORDER BY p.id`,
      [period.month_key]
    );

    const subscriptionRes = await client.query(
      `SELECT sss.*, fit.code AS fee_item_code, su.quantity AS usage_quantity
       FROM student_service_subscriptions sss
       JOIN fee_item_templates fit ON fit.id = sss.fee_item_template_id
       LEFT JOIN student_service_usage_entries su
         ON su.subscription_id = sss.id
        AND su.month_key = $1`,
      [period.month_key]
    );
    const subscriptionMap = new Map();
    for (const row of subscriptionRes.rows) {
      subscriptionMap.set(`${row.student_id}:${row.fee_item_template_id}:${row.fee_item_code || ""}`, row);
    }

    const adjustmentRes = await client.query(
      `SELECT fa.*, fit.code AS item_code
       FROM fee_adjustments fa
       LEFT JOIN fee_item_templates fit ON fit.id = fa.fee_item_template_id
       WHERE fa.period_id = $1
       ORDER BY fa.id`,
      [periodId]
    );
    const adjustmentMap = new Map();
    for (const row of adjustmentRes.rows) {
      const list = adjustmentMap.get(Number(row.student_id)) || [];
      list.push(row);
      adjustmentMap.set(Number(row.student_id), list);
    }

    const previousBalanceRes = await client.query(
      `SELECT sfp.student_id, COALESCE(SUM(sfp.final_amount - sfp.paid_amount), 0) AS balance
       FROM student_fee_periods sfp
       JOIN fee_periods fp ON fp.id = sfp.period_id
       WHERE fp.month_key < $1
       GROUP BY sfp.student_id`,
      [period.month_key]
    );
    const previousBalanceMap = new Map(previousBalanceRes.rows.map((row) => [Number(row.student_id), toMoney(row.balance)]));

    let generatedCount = 0;
    let periodBaseAmount = 0;

    for (const student of studentsRes.rows) {
      const ctx = { monthKey: period.month_key, periodId, attendanceMap, subscriptionMap };
      const lines = [];
      for (const item of items) {
        const line = calculateItemForStudent(item, student, ctx);
        if (line) lines.push(line);
      }

      const previousBalance = toMoney(previousBalanceMap.get(Number(student.id)) || 0);
      if (previousBalance !== 0) {
        lines.push(
          buildChargeLine({
            code: previousBalance > 0 ? "PREV-BALANCE" : "PREV-CREDIT",
            name: previousBalance > 0 ? "Công nợ kỳ trước" : "Khấu trừ dư kỳ trước",
            category: "adjustment",
            calcType: "manual",
            quantity: 1,
            unitPrice: Math.abs(previousBalance),
            baseAmount: previousBalance,
            finalAmount: previousBalance,
            formulaText: previousBalance > 0 ? "Cộng số tiền còn thiếu từ các kỳ trước" : "Khấu trừ số tiền đã nộp dư kỳ trước",
            note: "Tự động tổng hợp từ các kỳ trước",
            sourceType: "SystemRule",
            sourceReference: `student:${student.id}`,
            isOptional: false,
            sortOrder: 900,
            lineType: previousBalance > 0 ? "balance" : "credit",
          })
        );
      }

      for (const adjustment of adjustmentMap.get(Number(student.id)) || []) {
        lines.push(buildPeriodLineFromAdjustment(adjustment, 1000 + lines.length));
      }

      const { discountLines, appliedPolicies } = buildDiscountLines(student.id, lines, policyRes.rows);
      lines.push(...discountLines);
      lines.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

      const totals = summarizeStatementLines(lines);
      const paymentStatus = totals.finalAmount <= 0 ? "paid" : "unpaid";
      periodBaseAmount += totals.baseAmount;

      const inserted = await client.query(
        `INSERT INTO student_fee_periods
         (student_id, period_id, base_amount, previous_balance, adjustment_amount, discount_amount, final_amount, paid_amount, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8)
         RETURNING id`,
        [student.id, periodId, totals.baseAmount, totals.previousBalance, totals.adjustmentAmount, totals.discountAmount, totals.finalAmount, paymentStatus]
      );
      const studentFeePeriodId = inserted.rows[0].id;

      for (const line of lines) {
        await insertStudentStatementLine(client, studentFeePeriodId, line);
      }
      for (const discount of appliedPolicies) {
        await client.query(
          `INSERT INTO student_fee_period_discounts
           (student_fee_period_id, policy_id, policy_name, discount_type, discount_value, discount_amount)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [studentFeePeriodId, discount.policyId, discount.policyName, discount.discountType, discount.discountValue, discount.discountAmount]
        );
      }
      generatedCount++;
    }

    await client.query(
      `UPDATE fee_periods
       SET status = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [periodId]
    );
    await client.query("COMMIT");
    res.json({ ok: true, generatedCount, baseAmount: roundMoney(periodBaseAmount) });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.get("/periods/:id/students", async (req, res, next) => {
  try {
    const periodId = Number(req.params.id);
    const params = [periodId];
    const where = [`sfp.period_id = $1`];
    if (req.query.classId) {
      params.push(Number(req.query.classId));
      where.push(`s.class_id = $${params.length}`);
    }
    if (req.query.paymentStatus) {
      params.push(String(req.query.paymentStatus).trim());
      where.push(`sfp.payment_status = $${params.length}`);
    }
    if (req.query.hasDiscount === "true") where.push(`sfp.discount_amount > 0`);
    if (req.query.hasDiscount === "false") where.push(`sfp.discount_amount = 0`);
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      where.push(`s.name ILIKE $${params.length}`);
    }

    const result = await pool.query(
      `SELECT sfp.id, sfp.student_id, sfp.period_id, sfp.base_amount, sfp.previous_balance, sfp.adjustment_amount,
              sfp.discount_amount, sfp.final_amount, sfp.paid_amount, sfp.payment_status,
              s.name AS student_name, s.class_id, c.name AS class_name,
              COALESCE(line_agg.fixed_amount, 0) AS fixed_amount,
              COALESCE(line_agg.daily_amount, 0) AS daily_amount,
              COALESCE(line_agg.service_amount, 0) AS service_amount,
              COALESCE(line_agg.one_time_amount, 0) AS one_time_amount,
              COALESCE(line_agg.adjustment_lines, 0) AS adjustment_lines,
              COALESCE(line_agg.balance_amount, 0) AS balance_amount,
              COALESCE(line_agg.discount_lines, 0) AS discount_lines,
              prev.prev_final_amount
       FROM student_fee_periods sfp
       JOIN students s ON s.id = sfp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN LATERAL (
         SELECT
           SUM(CASE WHEN sfpi.category = 'fixed' AND sfpi.final_amount > 0 THEN sfpi.final_amount ELSE 0 END) AS fixed_amount,
           SUM(CASE WHEN sfpi.category = 'daily' AND sfpi.final_amount > 0 THEN sfpi.final_amount ELSE 0 END) AS daily_amount,
           SUM(CASE WHEN sfpi.category = 'service' AND sfpi.final_amount > 0 THEN sfpi.final_amount ELSE 0 END) AS service_amount,
           SUM(CASE WHEN sfpi.category = 'one_time' AND sfpi.final_amount > 0 THEN sfpi.final_amount ELSE 0 END) AS one_time_amount,
           SUM(CASE WHEN sfpi.line_type = 'adjustment' THEN sfpi.final_amount ELSE 0 END) AS adjustment_lines,
           SUM(CASE WHEN sfpi.line_type IN ('balance', 'credit') THEN sfpi.final_amount ELSE 0 END) AS balance_amount,
           SUM(CASE WHEN sfpi.line_type = 'discount' THEN ABS(sfpi.final_amount) ELSE 0 END) AS discount_lines
         FROM student_fee_period_items sfpi
         WHERE sfpi.student_fee_period_id = sfp.id
       ) AS line_agg ON TRUE
       LEFT JOIN LATERAL (
         SELECT prev_sfp.final_amount AS prev_final_amount
         FROM student_fee_periods prev_sfp
         JOIN fee_periods prev_fp ON prev_fp.id = prev_sfp.period_id
         JOIN fee_periods cur_fp ON cur_fp.id = sfp.period_id
         WHERE prev_sfp.student_id = sfp.student_id
           AND prev_fp.month_key < cur_fp.month_key
         ORDER BY prev_fp.month_key DESC
         LIMIT 1
       ) AS prev ON TRUE
       WHERE ${where.join(" AND ")}
       ORDER BY c.name NULLS LAST, s.name`,
      params
    );

    res.json(result.rows.map((row) => {
      const prevFinalAmount = toMoney(row.prev_final_amount);
      const finalAmount = toMoney(row.final_amount);
      return {
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        classId: row.class_id,
        className: row.class_name ?? "",
        fixedAmount: toMoney(row.fixed_amount),
        dailyAmount: toMoney(row.daily_amount),
        serviceAmount: toMoney(row.service_amount),
        oneTimeAmount: toMoney(row.one_time_amount),
        adjustmentAmount: toMoney(row.adjustment_lines),
        balanceAmount: toMoney(row.balance_amount),
        discountAmount: toMoney(row.discount_lines || row.discount_amount),
        baseAmount: toMoney(row.base_amount),
        previousBalance: toMoney(row.previous_balance),
        finalAmount,
        paidAmount: toMoney(row.paid_amount),
        remainingAmount: Math.max(finalAmount - toMoney(row.paid_amount), 0),
        paymentStatus: row.payment_status,
        previousFinalAmount: prevFinalAmount,
        changeAmount: roundMoney(finalAmount - prevFinalAmount),
        hasAlert: prevFinalAmount > 0 && finalAmount > prevFinalAmount * 1.2,
      };
    }));
  } catch (e) {
    next(e);
  }
});

router.get("/reports/period/:id", async (req, res, next) => {
  try {
    const periodId = Number(req.params.id);
    const periodRes = await pool.query(`SELECT * FROM fee_periods WHERE id = $1`, [periodId]);
    if (!periodRes.rowCount) return res.status(404).json({ error: "Fee period not found" });
    const summaryRes = await pool.query(
      `SELECT COUNT(*) AS student_count,
              COALESCE(SUM(base_amount), 0) AS base_amount,
              COALESCE(SUM(previous_balance), 0) AS previous_balance,
              COALESCE(SUM(adjustment_amount), 0) AS adjustment_amount,
              COALESCE(SUM(discount_amount), 0) AS discount_amount,
              COALESCE(SUM(final_amount), 0) AS final_amount,
              COALESCE(SUM(paid_amount), 0) AS paid_amount,
              COALESCE(SUM(GREATEST(final_amount - paid_amount, 0)), 0) AS remaining_amount,
              COUNT(*) FILTER (WHERE payment_status = 'unpaid') AS unpaid_count,
              COUNT(*) FILTER (WHERE payment_status = 'partial') AS partial_count,
              COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_count
       FROM student_fee_periods
       WHERE period_id = $1`,
      [periodId]
    );
    const classRes = await pool.query(
      `SELECT COALESCE(c.name, 'Chưa xếp lớp') AS class_name,
              COUNT(*) AS student_count,
              COALESCE(SUM(sfp.final_amount), 0) AS final_amount,
              COALESCE(SUM(sfp.paid_amount), 0) AS paid_amount,
              COALESCE(SUM(GREATEST(sfp.final_amount - sfp.paid_amount, 0)), 0) AS remaining_amount
       FROM student_fee_periods sfp
       JOIN students s ON s.id = sfp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE sfp.period_id = $1
       GROUP BY COALESCE(c.name, 'Chưa xếp lớp')
       ORDER BY class_name`,
      [periodId]
    );
    const categoryRes = await pool.query(
      `SELECT category, line_type, COALESCE(SUM(final_amount), 0) AS amount
       FROM student_fee_period_items
       WHERE student_fee_period_id IN (SELECT id FROM student_fee_periods WHERE period_id = $1)
       GROUP BY category, line_type
       ORDER BY category, line_type`,
      [periodId]
    );
    const summary = summaryRes.rows[0] || {};
    const period = periodRes.rows[0];
    res.json({
      period: {
        id: period.id,
        monthKey: period.month_key,
        title: period.title,
        dueDate: period.due_date ? String(period.due_date).slice(0, 10) : "",
        status: period.status,
      },
      summary: {
        studentCount: Number(summary.student_count || 0),
        baseAmount: toMoney(summary.base_amount),
        previousBalance: toMoney(summary.previous_balance),
        adjustmentAmount: toMoney(summary.adjustment_amount),
        discountAmount: toMoney(summary.discount_amount),
        finalAmount: toMoney(summary.final_amount),
        paidAmount: toMoney(summary.paid_amount),
        remainingAmount: toMoney(summary.remaining_amount),
        unpaidCount: Number(summary.unpaid_count || 0),
        partialCount: Number(summary.partial_count || 0),
        paidCount: Number(summary.paid_count || 0),
      },
      byClass: classRes.rows.map((row) => ({
        className: row.class_name,
        studentCount: Number(row.student_count || 0),
        finalAmount: toMoney(row.final_amount),
        paidAmount: toMoney(row.paid_amount),
        remainingAmount: toMoney(row.remaining_amount),
      })),
      byCategory: categoryRes.rows.map((row) => ({
        category: row.category,
        lineType: row.line_type,
        amount: toMoney(row.amount),
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/student-periods/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const detailRes = await pool.query(
      `SELECT sfp.*, s.name AS student_name, s.class_id, c.name AS class_name,
              fp.title AS period_title, fp.month_key, fp.due_date, fp.status AS period_status
       FROM student_fee_periods sfp
       JOIN students s ON s.id = sfp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_periods fp ON fp.id = sfp.period_id
       WHERE sfp.id = $1`,
      [id]
    );
    if (!detailRes.rowCount) return res.status(404).json({ error: "Student fee period not found" });
    const row = detailRes.rows[0];
    const itemsRes = await pool.query(
      `SELECT * FROM student_fee_period_items WHERE student_fee_period_id = $1 ORDER BY sort_order, id`,
      [id]
    );
    const discountsRes = await pool.query(
      `SELECT * FROM student_fee_period_discounts WHERE student_fee_period_id = $1 ORDER BY id`,
      [id]
    );
    const paymentsRes = await pool.query(
      `SELECT fp.*, u.name AS created_by_name
       FROM fee_payments fp
       LEFT JOIN users u ON u.id = fp.created_by_user_id
       WHERE fp.student_fee_period_id = $1
       ORDER BY fp.paid_at DESC, fp.id DESC`,
      [id]
    );
    const adjustmentsRes = await pool.query(
      `SELECT * FROM fee_adjustments WHERE period_id = $1 AND student_id = $2 ORDER BY id DESC`,
      [row.period_id, row.student_id]
    );
    const previousMonthRes = await pool.query(
      `SELECT prev_fp.month_key, prev_sfp.final_amount
       FROM student_fee_periods prev_sfp
       JOIN fee_periods prev_fp ON prev_fp.id = prev_sfp.period_id
       JOIN fee_periods cur_fp ON cur_fp.id = $1
       WHERE prev_sfp.student_id = $2
         AND prev_fp.month_key < cur_fp.month_key
       ORDER BY prev_fp.month_key DESC
       LIMIT 1`,
      [row.period_id, row.student_id]
    );
    const prevRow = previousMonthRes.rows[0] || null;
    const previousFinalAmount = prevRow ? toMoney(prevRow.final_amount) : 0;
    const currentFinalAmount = toMoney(row.final_amount);
    res.json({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      classId: row.class_id,
      className: row.class_name ?? "",
      periodId: row.period_id,
      periodTitle: row.period_title,
      monthKey: row.month_key,
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : "",
      periodStatus: row.period_status,
      baseAmount: toMoney(row.base_amount),
      previousBalance: toMoney(row.previous_balance),
      adjustmentAmount: toMoney(row.adjustment_amount),
      discountAmount: toMoney(row.discount_amount),
      finalAmount: currentFinalAmount,
      paidAmount: toMoney(row.paid_amount),
      remainingAmount: Math.max(currentFinalAmount - toMoney(row.paid_amount), 0),
      paymentStatus: row.payment_status,
      previousFinalAmount,
      hasAlert: previousFinalAmount > 0 && currentFinalAmount > previousFinalAmount * 1.2,
      items: itemsRes.rows.map((item) => ({
        id: item.id,
        name: item.item_name,
        code: item.item_code ?? "",
        lineType: item.line_type ?? "charge",
        category: item.category ?? "fixed",
        calcType: item.calc_type ?? "monthly_fixed",
        quantity: toMoney(item.quantity),
        unitPrice: toMoney(item.unit_price),
        amount: toMoney(item.base_amount),
        finalAmount: toMoney(item.final_amount),
        formulaText: item.formula_text ?? "",
        note: item.note ?? "",
        sourceType: item.source_type ?? "SystemRule",
        sourceReference: item.source_reference ?? "",
        isOptional: Boolean(item.is_optional),
      })),
      discounts: discountsRes.rows.map((discount) => ({
        id: discount.id,
        policyId: discount.policy_id,
        policyName: discount.policy_name,
        discountType: discount.discount_type,
        discountValue: toMoney(discount.discount_value),
        discountAmount: toMoney(discount.discount_amount),
      })),
      adjustments: adjustmentsRes.rows.map((adjustment) => ({
        id: adjustment.id,
        lineName: adjustment.line_name,
        adjustmentType: adjustment.adjustment_type,
        quantity: toMoney(adjustment.quantity),
        unitPrice: toMoney(adjustment.unit_price),
        amount: toMoney(adjustment.amount),
        note: adjustment.note ?? "",
        createdAt: adjustment.created_at instanceof Date ? adjustment.created_at.toISOString() : String(adjustment.created_at || ""),
      })),
      payments: paymentsRes.rows.map((payment) => ({
        id: payment.id,
        amount: toMoney(payment.amount),
        paidAt: payment.paid_at instanceof Date ? payment.paid_at.toISOString() : String(payment.paid_at || ""),
        method: payment.method,
        invoiceNumber: payment.invoice_number ?? "",
        note: payment.note ?? "",
        createdByName: payment.created_by_name ?? "",
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/student-periods/:id/adjustments", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const current = await client.query(
      `SELECT sfp.*, fp.status AS period_status
       FROM student_fee_periods sfp
       JOIN fee_periods fp ON fp.id = sfp.period_id
       WHERE sfp.id = $1`,
      [id]
    );
    if (!current.rowCount) return res.status(404).json({ error: "Student fee period not found" });
    const cur = current.rows[0];
    const lineName = normalizeText(req.body?.lineName, "lineName");
    if (lineName?.error) return res.status(400).json({ error: lineName.error });
    const adjustmentType = normalizeEnum(req.body?.adjustmentType, ADJUSTMENT_TYPES, "adjustmentType", "charge");
    if (adjustmentType?.error) return res.status(400).json({ error: adjustmentType.error });
    const quantity = normalizeMoney(req.body?.quantity ?? 1, "quantity");
    if (quantity?.error) return res.status(400).json({ error: quantity.error });
    const unitPrice = normalizeMoney(req.body?.unitPrice ?? 0, "unitPrice");
    if (unitPrice?.error) return res.status(400).json({ error: unitPrice.error });
    const rawAmount =
      req.body?.amount !== undefined && req.body?.amount !== null && String(req.body.amount).trim() !== ""
        ? normalizeSignedMoney(req.body.amount, "amount")
        : roundMoney(quantity * unitPrice);
    if (rawAmount?.error) return res.status(400).json({ error: rawAmount.error });
    const amount =
      adjustmentType === "discount" || adjustmentType === "refund" || adjustmentType === "carry_forward"
        ? -Math.abs(rawAmount)
        : rawAmount;
    const feeItemTemplateId =
      req.body?.feeItemTemplateId !== undefined && req.body?.feeItemTemplateId !== null
        ? Number(req.body.feeItemTemplateId)
        : null;

    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO fee_adjustments
       (student_id, period_id, fee_item_template_id, line_name, adjustment_type, quantity, unit_price, amount, note, source_type, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Adjustment', $10)
       RETURNING *`,
      [
        cur.student_id,
        cur.period_id,
        Number.isInteger(feeItemTemplateId) && feeItemTemplateId > 0 ? feeItemTemplateId : null,
        lineName,
        adjustmentType,
        quantity,
        unitPrice,
        amount,
        String(req.body?.note ?? "").trim(),
        req.user.id,
      ]
    );
    await insertStudentStatementLine(client, id, buildPeriodLineFromAdjustment(inserted.rows[0], 1200 + Number(inserted.rows[0].id)));
    const totals = await recalcStudentPeriodTotals(client, id);
    await client.query("COMMIT");
    res.status(201).json({ ok: true, adjustmentId: inserted.rows[0].id, totals });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.post("/student-periods/:id/payments", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const amount = normalizeMoney(req.body?.amount, "amount");
    if (amount?.error || amount <= 0) return res.status(400).json({ error: "amount must be greater than 0" });
    const paidDate = normalizeOptionalDate(req.body?.paidDate, "paidDate");
    if (paidDate?.error) return res.status(400).json({ error: paidDate.error });
    const invoiceNumber = String(req.body?.invoiceNumber ?? "").trim();
    const method = String(req.body?.method ?? "cash").trim() || "cash";
    const note = String(req.body?.note ?? "").trim();

    await client.query("BEGIN");
    const current = await client.query(`SELECT * FROM student_fee_periods WHERE id = $1 FOR UPDATE`, [id]);
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student fee period not found" });
    }
    const cur = current.rows[0];
    const nextPaid = roundMoney(toMoney(cur.paid_amount) + amount);
    const finalAmount = toMoney(cur.final_amount);
    const nextStatus =
      finalAmount <= 0 ? "paid" : nextPaid <= 0 ? "unpaid" : nextPaid >= finalAmount ? "paid" : "partial";

    await client.query(
      `INSERT INTO fee_payments (student_fee_period_id, amount, paid_at, method, invoice_number, note, created_by_user_id)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4, $5, $6, $7)`,
      [id, amount, paidDate, method, invoiceNumber, note, req.user.id]
    );
    await client.query(
      `UPDATE student_fee_periods
       SET paid_amount = $1, payment_status = $2, updated_at = NOW()
       WHERE id = $3`,
      [nextPaid, nextStatus, id]
    );
    await client.query("COMMIT");
    res.status(201).json({
      ok: true,
      paidAmount: nextPaid,
      paymentStatus: nextStatus,
      overpaidAmount: Math.max(nextPaid - finalAmount, 0),
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

export default router;
