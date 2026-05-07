"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ExternalLink, Pencil, RefreshCcw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  approveDeal,
  confirmReceived,
  getDeal,
  getPaymentInstruction,
  openDispute,
  updateDealSection,
  uploadPaymentProof,
  uploadShippingProof,
  joinDeal,
} from "@/lib/api";
import { sellerAccept, sellerReject, cancelDeal } from '@/lib/api';
import { SellerAcceptPanel } from '@/components/deal/seller-accept-panel';
import { BuyerTermsPanel } from '@/components/deal/buyer-terms-panel';
import { getErrorMessage } from "@/lib/errors";
import {
  getStoredAccessToken,
  getStoredInviteLink,
  setStoredAccessToken,
} from "@/lib/token-store";
import { formatCurrency } from "@/lib/utils";
import { PublicHeader } from "@/components/layout/public-header";
import { useI18n } from "@/components/providers/app-providers";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DealStatusCard } from "@/components/deal/deal-status-card";
import { ProductCard } from "@/components/deal/product-card";
import { ParticipantCard } from "@/components/deal/participant-card";
import { PriceSummaryCard } from "@/components/deal/price-summary-card";
import { EscrowExplanationCard } from "@/components/deal/escrow-explanation-card";
import { MissingFieldsChecklist } from "@/components/deal/missing-fields-checklist";
import { Timeline } from "@/components/deal/timeline";
import { CopyLinkButton } from "@/components/deal/copy-link-button";
import { ImageUploader } from "@/components/deal/image-uploader";
import { ReceiptUploader } from "@/components/deal/receipt-uploader";
import { ConfirmDialog } from "@/components/deal/confirm-dialog";
import { DisputeForm } from "@/components/deal/dispute-form";
import { ActionButton, PrimaryActionBar } from "@/components/deal/primary-action-bar";
import { SectionCard } from "@/components/deal/section-card";
import type { DealResponse, DisputeReason } from "@/types/api";

const initialProductForm = {
  title: "",
  type: "",
  description: "",
  quantity: "1",
  condition: "",
  amount: "",
  currency: "USD",
};

const initialParticipantForm = {
  name: "",
  phone: "",
  preferred_language: "en",
  telegram_chat_id: "",
  wechat_id: "",
  messenger_name: "",
};

const initialPayoutForm = {
  payout_khqr: "",
  payout_bank_name: "",
  payout_account_name: "",
  payout_account_number: "",
};

export function DealRoomPage({ publicId }: { publicId: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessFromUrl = searchParams.get("access");
  const inviteToken = searchParams.get("invite");
  const [localAccessToken, setLocalAccessToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? getStoredAccessToken(publicId) : null,
  );
  const [localInviteLink] = useState<string | null>(() =>
    typeof window !== "undefined" ? getStoredInviteLink(publicId) : null,
  );

  const [deal, setDeal] = useState<DealResponse | null>(null);
  const [paymentInstruction, setPaymentInstruction] = useState<{
    receiver_account_label: string | null;
    receiver_account_id: string | null;
    expected_amount: number | null;
    currency: string;
    reference_note: string;
    khqr_string: string | null;
    khqr_md5: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinForm, setJoinForm] = useState({
    role: "buyer",
    name: "",
    phone: "",
  });
  const [productForm, setProductForm] = useState(initialProductForm);
  const [participantForm, setParticipantForm] = useState(initialParticipantForm);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [payoutForm, setPayoutForm] = useState(initialPayoutForm);
  const [editor, setEditor] = useState<null | "product" | "participant" | "delivery" | "payout">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [buyerTermsAgreed, setBuyerTermsAgreed] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [packagePhoto, setPackagePhoto] = useState<File | null>(null);
  const [deliveryReceipt, setDeliveryReceipt] = useState<File | null>(null);
  const [shippingForm, setShippingForm] = useState({
    delivery_company: "",
    tracking_number: "",
    seller_note: "",
  });
  const [disputeReason, setDisputeReason] =
    useState<DisputeReason>("ITEM_NOT_RECEIVED");
  const [disputeMessage, setDisputeMessage] = useState("");
  const [disputeFile, setDisputeFile] = useState<File | null>(null);

  const activeAccessToken = accessFromUrl || localAccessToken;
  const activeInviteLink = localInviteLink;

  const canJoinOnly = !activeAccessToken && !!inviteToken;

  const actionSet = useMemo(
    () => new Set(deal?.allowed_actions ?? []),
    [deal?.allowed_actions],
  );

  const fetchDealState = useCallback(async () => {
    const result = await getDeal(publicId, {
      accessToken: activeAccessToken,
      inviteToken: activeAccessToken ? null : inviteToken,
    });

    let instruction: typeof paymentInstruction = null;
if (
  result.status === "PENDING_BUYER_PAYMENT" ||
  result.status === "PENDING_SELLER_APPROVAL" ||
  result.status === "PAYMENT_PENDING_VERIFICATION"
) {
      try {
        instruction = await getPaymentInstruction(publicId, {
          accessToken: activeAccessToken,
          inviteToken: activeAccessToken ? null : inviteToken,
        });
      } catch {
        instruction = null;
      }
    }

    return { result, instruction };
  }, [activeAccessToken, inviteToken, publicId]);

  const refreshDeal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { result, instruction } = await fetchDealState();
      setDeal(result);
      setPaymentInstruction(instruction);
      setJoinForm((current) => ({
        ...current,
        role: result.creator_role === "seller" ? "buyer" : "seller",
      }));
      setPaymentAmount(String(result.amount ?? ""));

      if (activeAccessToken && accessFromUrl) {
        setStoredAccessToken(publicId, accessFromUrl);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [accessFromUrl, activeAccessToken, fetchDealState, publicId, t]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { result, instruction } = await fetchDealState();
        if (cancelled) return;
        setDeal(result);
        setPaymentInstruction(instruction);
        setJoinForm((current) => ({
          ...current,
          role: result.creator_role === "seller" ? "buyer" : "seller",
        }));
        setPaymentAmount(String(result.amount ?? ""));

        if (accessFromUrl) {
          setStoredAccessToken(publicId, accessFromUrl);
          setLocalAccessToken(accessFromUrl);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, t));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [accessFromUrl, fetchDealState, inviteToken, publicId, t]);

  async function handleJoin() {
    if (!inviteToken || !joinForm.name.trim()) {
      setError(t("errors.validation.failed"));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await joinDeal(publicId, {
        invite_token: inviteToken,
        role: joinForm.role,
        name: joinForm.name,
        phone: joinForm.phone || undefined,
        preferred_language: locale,
      });
      setStoredAccessToken(publicId, result.access_token);
      setLocalAccessToken(result.access_token);
      router.replace(`/d/${publicId}?access=${result.access_token}`);
    } catch (joinError) {
      setError(getErrorMessage(joinError, t));
    } finally {
      setPending(false);
    }
  }

  async function runAction(task: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await task();
      await refreshDeal();
      setEditor(null);
      setPaymentFile(null);
      setPackagePhoto(null);
      setDeliveryReceipt(null);
      setDisputeFile(null);
      setConfirmOpen(false);
    } catch (actionError) {
      setError(getErrorMessage(actionError, t));
    } finally {
      setPending(false);
    }
  }

  const currentRole = deal?.current_user_role ?? null;
  const isPreview = canJoinOnly;

  function openProductEditor() {
    if (!deal) return;
    setProductForm({
      title: deal.product?.title ?? "",
      type: deal.product?.type ?? "",
      description: deal.product?.description ?? "",
      quantity: String(deal.product?.quantity ?? 1),
      condition: deal.product?.condition ?? "",
      amount: String(deal.amount ?? ""),
      currency: deal.currency || "USD",
    });
    setEditor("product");
  }

  function openParticipantEditor() {
    if (!deal) return;
    const currentParticipant =
      deal.participants.find((item) => item.role === deal.current_user_role) ??
      deal.participants[0];
    setParticipantForm({
      name: currentParticipant?.name ?? "",
      phone: "",
      preferred_language: currentParticipant?.preferred_language ?? locale,
      telegram_chat_id: "",
      wechat_id: "",
      messenger_name: "",
    });
    setEditor("participant");
  }

  function openPayoutEditor() {
    setPayoutForm(initialPayoutForm);
    setEditor("payout");
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="container-shell py-8 pb-20">
        {loading ? (
          <div className="soft-card rounded-lg p-8 text-sm text-[var(--ink-soft)]">
            {t("common.loading")}...
          </div>
        ) : error && !deal ? (
          <section className="soft-card rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--danger)]" />
              <div>
                <h1 className="text-lg font-semibold text-[var(--ink)]">{error}</h1>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  {inviteToken ? t("deal.join.invalid") : t("errors.fallback")}
                </p>
                <Button className="mt-4 gap-2" onClick={() => void refreshDeal()}>
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  {t("common.retry")}
                </Button>
              </div>
            </div>
          </section>
        ) : deal ? (
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <DealStatusCard deal={deal} />
              {error ? (
                <div className="rounded-lg border border-[rgba(180,67,52,0.25)] bg-[rgba(180,67,52,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              ) : null}

              {isPreview ? (
                <SectionCard
                  title={t("deal.join.preview")}
                  description={t("deal.preview.private_hidden")}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label={t("deal.section.product")} value={deal.product?.title || "--"} />
                    <Info
                      label={t("deal.create.amount")}
                      value={formatCurrency(deal.amount, deal.currency, locale)}
                    />
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label={t("deal.join.role")} required>
                      <Select
                        value={joinForm.role}
                        onChange={(event) =>
                          setJoinForm((current) => ({
                            ...current,
                            role: event.target.value as "buyer" | "seller",
                          }))
                        }
                      >
                        <option value="buyer">{t("deal.role.buyer")}</option>
                        <option value="seller">{t("deal.role.seller")}</option>
                      </Select>
                    </Field>
                    <Field label={t("deal.create.your_name")} required>
                      <Input
                        value={joinForm.name}
                        onChange={(event) =>
                          setJoinForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label={t("deal.create.phone")}>
                        <Input
                          value={joinForm.phone}
                          onChange={(event) =>
                            setJoinForm((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Button onClick={() => void handleJoin()} disabled={pending}>
                      {t("deal.join.submit")}
                    </Button>
                  </div>
                </SectionCard>
              ) : (
                <>
                  <ProductCard
                    deal={deal}
                    action={
                      actionSet.has("update_product") ? (
                        <EditTrigger onClick={() => (editor === "product" ? setEditor(null) : openProductEditor())} />
                      ) : null
                    }
                  />
                  {editor === "product" ? (
                    <EditorCard
                      title={t("deal.section.product")}
                      onSave={() =>
                        runAction(async () => {
                          await updateDealSection(
                            publicId,
                            "product",
                            {
                              title: productForm.title,
                              type: productForm.type || undefined,
                              description: productForm.description || undefined,
                              quantity: Number(productForm.quantity || "1"),
                              condition: productForm.condition || undefined,
                              amount: Number(productForm.amount),
                              currency: productForm.currency,
                            },
                            { accessToken: activeAccessToken },
                          );
                        })
                      }
                      onCancel={() => setEditor(null)}
                      pending={pending}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("deal.create.product_title")} required>
                          <Input
                            value={productForm.title}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("deal.create.product_type")}>
                          <Input
                            value={productForm.type}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                type: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label={t("deal.create.product_description")}>
                            <Textarea
                              value={productForm.description}
                              onChange={(event) =>
                                setProductForm((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                            />
                          </Field>
                        </div>
                        <Field label={t("field.quantity")}>
                          <Input
                            inputMode="numeric"
                            value={productForm.quantity}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                quantity: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label="Condition">
                          <Input
                            value={productForm.condition}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                condition: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("deal.create.amount")} required>
                          <Input
                            inputMode="decimal"
                            value={productForm.amount}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                amount: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("common.currency")}>
                          <Select
                            value={productForm.currency}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                currency: event.target.value,
                              }))
                            }
                          >
                            <option value="USD">USD</option>
                            <option value="KHR">KHR</option>
                          </Select>
                        </Field>
                      </div>
                    </EditorCard>
                  ) : null}

                  <ParticipantCard
                    deal={deal}
                    action={
                      actionSet.has("update_participant") ? (
                        <EditTrigger onClick={() => (editor === "participant" ? setEditor(null) : openParticipantEditor())} />
                      ) : null
                    }
                  />
                  {editor === "participant" ? (
                    <EditorCard
                      title={t("deal.section.participants")}
                      onSave={() =>
                        runAction(async () => {
                          await updateDealSection(
                            publicId,
                            "participant",
                            participantForm,
                            { accessToken: activeAccessToken },
                          );
                        })
                      }
                      onCancel={() => setEditor(null)}
                      pending={pending}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("deal.create.your_name")} required>
                          <Input
                            value={participantForm.name}
                            onChange={(event) =>
                              setParticipantForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("field.phone")}>
                          <Input
                            value={participantForm.phone}
                            onChange={(event) =>
                              setParticipantForm((current) => ({
                                ...current,
                                phone: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("field.preferred_language")}>
                          <Select
                            value={participantForm.preferred_language}
                            onChange={(event) =>
                              setParticipantForm((current) => ({
                                ...current,
                                preferred_language: event.target.value,
                              }))
                            }
                          >
                            <option value="en">English</option>
                            <option value="km">Khmer</option>
                            <option value="zh">Chinese</option>
                          </Select>
                        </Field>
                        <Field label={t("field.telegram_chat_id")}>
                          <Input
                            value={participantForm.telegram_chat_id}
                            onChange={(event) =>
                              setParticipantForm((current) => ({
                                ...current,
                                telegram_chat_id: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("field.wechat_id")}>
                          <Input
                            value={participantForm.wechat_id}
                            onChange={(event) =>
                              setParticipantForm((current) => ({
                                ...current,
                                wechat_id: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t("field.messenger_name")}>
                          <Input
                            value={participantForm.messenger_name}
                            onChange={(event) =>
                              setParticipantForm((current) => ({
                                ...current,
                                messenger_name: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>
                    </EditorCard>
                  ) : null}

                  {currentRole === "seller" ? (
                    <>
                      <SectionCard
                        title={t("payout.section.title")}
                        description={t("payout.section.hint")}
                        action={
                          <EditTrigger
                            onClick={() =>
                              editor === "payout" ? setEditor(null) : openPayoutEditor()
                            }
                          />
                        }
                      >
                        {deal.participants.find((p) => p.role === "seller")?.has_payout ? (
                          <p className="text-sm text-[var(--ink-soft)]">
                            ✓ Payout info saved. Buyer cannot see your details.
                          </p>
                        ) : (
                          <p className="text-sm text-[var(--danger)]">
                            ⚠ No payout info yet. Add your Bakong ID or bank account so you can receive payment.
                          </p>
                        )}
                      </SectionCard>
                      {editor === "payout" ? (
                        <EditorCard
                          title="Seller payout"
                          onSave={() =>
                            runAction(async () => {
                              await updateDealSection(
                                publicId,
                                "payout",
                                payoutForm,
                                { accessToken: activeAccessToken },
                              );
                            })
                          }
                          onCancel={() => setEditor(null)}
                          pending={pending}
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Field label={t("field.payout_khqr")}>
                                <Textarea
                                  value={payoutForm.payout_khqr}
                                  onChange={(event) =>
                                    setPayoutForm((current) => ({
                                      ...current,
                                      payout_khqr: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                            </div>
                            <Field label={t("field.payout_bank_name")}>
                              <Input
                                value={payoutForm.payout_bank_name}
                                onChange={(event) =>
                                  setPayoutForm((current) => ({
                                    ...current,
                                    payout_bank_name: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label={t("field.payout_account_name")}>
                              <Input
                                value={payoutForm.payout_account_name}
                                onChange={(event) =>
                                  setPayoutForm((current) => ({
                                    ...current,
                                    payout_account_name: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label={t("field.payout_account_number")}>
                              <Input
                                value={payoutForm.payout_account_number}
                                onChange={(event) =>
                                  setPayoutForm((current) => ({
                                    ...current,
                                    payout_account_number: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                          </div>
                        </EditorCard>
                      ) : null}
                    </>
                  ) : null}

                                      {/* Seller Accept/Reject Panel */}
                    {deal.status === 'PAID_WAITING_SELLER_APPROVAL' && currentRole === 'seller' && (
                      <SellerAcceptPanel
                        amount={deal.amount}
                        currency={deal.currency}
                        productTitle={deal.product?.title ?? null}
                        buyerName={deal.participants.find(p => p.role === 'buyer')?.name ?? null}
                        pending={pending}
                        onAccept={(payload) =>
                          runAction(async () => {
                            await sellerAccept(publicId, payload, { accessToken: activeAccessToken });
                          })
                        }
                        onReject={() =>
                          runAction(async () => {
                            await sellerReject(publicId, { accessToken: activeAccessToken });
                          })
                        }
                      />
                    )}

                    {/* Buyer Cancel Section */}
                    {(deal.status === 'PENDING_SELLER_APPROVAL' || deal.status === 'PAID_WAITING_SELLER_APPROVAL') && currentRole === 'buyer' && (
                      <div className='rounded-xl border border-[rgba(180,67,52,0.2)] bg-[rgba(180,67,52,0.04)] p-4'>
                        <p className='text-sm font-semibold text-[var(--ink)]'>Cancel this deal?</p>
                        <p className='mt-1 text-sm text-[var(--ink-soft)]'>
                          {deal.status === 'PAID_WAITING_SELLER_APPROVAL'
                            ? 'Seller has not accepted yet. If you cancel, your payment will be refunded.'
                            : 'The seller has not accepted yet. You can cancel and no charges apply.'}
                        </p>
                        <button
                          onClick={() =>
                            runAction(async () => {
                              await cancelDeal(publicId, { accessToken: activeAccessToken });
                            })
                          }
                          disabled={pending}
                          className='mt-3 rounded-lg border border-[var(--danger)] px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[rgba(180,67,52,0.08)] disabled:opacity-50'
                        >
                          Cancel Deal
                        </button>
                      </div>
                    )}

                    <PriceSummaryCard deal={deal} />
                  <EscrowExplanationCard />
                  <MissingFieldsChecklist items={deal.missing_fields} />

                  <SectionCard
                    title={t("deal.section.delivery")}
                    action={
                      actionSet.has("update_participant") ? (
                        <EditTrigger onClick={() => setEditor(editor === "delivery" ? null : "delivery")} />
                      ) : null
                    }
                  >
                    <p className="text-sm text-[var(--ink-soft)]">
                      {deliveryNote || "Delivery notes are still optional for this MVP."}
                    </p>
                  </SectionCard>
                  {editor === "delivery" ? (
                    <EditorCard
                      title={t("deal.section.delivery")}
                      onSave={() =>
                        runAction(async () => {
                          await updateDealSection(
                            publicId,
                            "delivery",
                            { notes: deliveryNote },
                            { accessToken: activeAccessToken },
                          );
                        })
                      }
                      onCancel={() => setEditor(null)}
                      pending={pending}
                    >
                      <Field label={t("field.delivery_notes")}>
                        <Textarea
                          value={deliveryNote}
                          onChange={(event) => setDeliveryNote(event.target.value)}
                        />
                      </Field>
                    </EditorCard>
                  ) : null}

{(deal.status === "PENDING_BUYER_PAYMENT" || deal.status === "PENDING_SELLER_APPROVAL" ||
  deal.payment_summary ||
  actionSet.has("upload_payment_proof")) && (
                    <SectionCard
                      title={t("payment.title")}
                      description={t("payment.instruction")}
                      className="scroll-mt-24"
                    >
                      <div id="payment-section" className="space-y-4">
                        {paymentInstruction ? (
                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Info
                                label={t("payment.amount_due")}
                                value={formatCurrency(
                                  paymentInstruction.expected_amount,
                                  paymentInstruction.currency,
                                  locale,
                                )}
                              />
                              <Info
                                label={t("payment.receiver")}
                                value={paymentInstruction.receiver_account_label || "--"}
                              />
                              {paymentInstruction.receiver_account_id ? (
                                <div className="sm:col-span-2">
                                  <Info
                                    label={t("payment.bakong_account")}
                                    value={paymentInstruction.receiver_account_id}
                                  />
                                </div>
                              ) : null}
                            </div>
                            {paymentInstruction.khqr_string ? (
                              <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-5">
                                <p className="text-sm font-medium text-[var(--ink)]">
                                  {t("payment.scan_khqr")}
                                </p>
                                <QRCodeSVG
                                  value={paymentInstruction.khqr_string}
                                  size={200}
                                  includeMargin
                                />
                                <p className="break-all text-center text-xs text-[var(--ink-soft)]">
                                  {paymentInstruction.reference_note}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {deal.payment_summary ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                            <div className="text-sm font-medium text-[var(--ink)]">
                              {t("payment.awaiting_admin")}
                            </div>
                            {deal.payment_summary.proof_image_url ? (
                              <img
                                src={deal.payment_summary.proof_image_url}
                                alt=""
                                className="mt-3 max-h-64 rounded-lg border border-[var(--border)] object-cover"
                              />
                            ) : null}
                          </div>
                        ) : null}
                        {actionSet.has("upload_payment_proof") ? (
                          <>
                            <Field label={t("field.paid_amount")} required>
                              <Input
                                inputMode="decimal"
                                value={paymentAmount}
                                onChange={(event) => setPaymentAmount(event.target.value)}
                              />
                            </Field>
                            <Field label={t("payment.receipt")} required>
                              <ReceiptUploader
                                value={paymentFile}
                                onChange={setPaymentFile}
                              />
                            </Field>
                            <Field label={t("field.seller_note")}>
                              <Textarea
                                value={paymentNote}
                                onChange={(event) => setPaymentNote(event.target.value)}
                              />
                            </Field>
                            <Button
                              onClick={() =>
                                runAction(async () => {
                                  const formData = new FormData();
                                  formData.set("paid_amount", paymentAmount);
                                  if (paymentNote.trim()) {
                                    formData.set("buyer_note", paymentNote);
                                  }
                                  if (paymentFile) {
                                    formData.set("proof_image", paymentFile);
                                  }
                                  await uploadPaymentProof(publicId, formData, {
                                    accessToken: activeAccessToken,
                                  });
                                })
                              }
                              disabled={pending || !paymentFile}
                            >
                              {t("payment.submit")}
                            </Button>
                          </>
                        ) : currentRole === "seller" ? (
                          <p className="text-sm text-[var(--ink-soft)]">
                            Wait for the buyer to send payment proof or for admin verification.
                          </p>
                        ) : null}
                      </div>
                    </SectionCard>
                  )}

                  {(deal.status === "PAID_ESCROWED" ||
                    deal.status === "SELLER_ACCEPTED_PACKING" ||
                    deal.status === "SHIPPED" ||
                    deal.shipping_summary ||
                    actionSet.has("upload_shipping_proof")) && (
                    <SectionCard title={t("shipping.title")} className="scroll-mt-24">
                      <div id="shipping-section" className="space-y-4">
                        {deal.shipping_summary ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Info
                              label={t("field.delivery_company")}
                              value={deal.shipping_summary.delivery_company || "--"}
                            />
                            <Info
                              label={t("field.tracking_number")}
                              value={deal.shipping_summary.tracking_number || "--"}
                            />
                            {deal.shipping_summary.package_photo_url ? (
                              <img
                                src={deal.shipping_summary.package_photo_url}
                                alt=""
                                className="rounded-lg border border-[var(--border)] object-cover"
                              />
                            ) : null}
                            {deal.shipping_summary.delivery_receipt_url ? (
                              <img
                                src={deal.shipping_summary.delivery_receipt_url}
                                alt=""
                                className="rounded-lg border border-[var(--border)] object-cover"
                              />
                            ) : null}
                          </div>
                        ) : null}
                        {actionSet.has("upload_shipping_proof") ? (
                          <>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field label={t("field.delivery_company")}>
                                <Input
                                  value={shippingForm.delivery_company}
                                  onChange={(event) =>
                                    setShippingForm((current) => ({
                                      ...current,
                                      delivery_company: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                              <Field label={t("field.tracking_number")}>
                                <Input
                                  value={shippingForm.tracking_number}
                                  onChange={(event) =>
                                    setShippingForm((current) => ({
                                      ...current,
                                      tracking_number: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                              <Field label={t("field.package_photo")}>
                                <ImageUploader value={packagePhoto} onChange={setPackagePhoto} />
                              </Field>
                              <Field label={t("field.delivery_receipt")}>
                                <ImageUploader
                                  value={deliveryReceipt}
                                  onChange={setDeliveryReceipt}
                                />
                              </Field>
                              <div className="sm:col-span-2">
                                <Field label={t("field.seller_note")}>
                                  <Textarea
                                    value={shippingForm.seller_note}
                                    onChange={(event) =>
                                      setShippingForm((current) => ({
                                        ...current,
                                        seller_note: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                              </div>
                            </div>
                            <Button
                              onClick={() =>
                                runAction(async () => {
                                  const formData = new FormData();
                                  if (shippingForm.delivery_company) {
                                    formData.set(
                                      "delivery_company",
                                      shippingForm.delivery_company,
                                    );
                                  }
                                  if (shippingForm.tracking_number) {
                                    formData.set(
                                      "tracking_number",
                                      shippingForm.tracking_number,
                                    );
                                  }
                                  if (shippingForm.seller_note) {
                                    formData.set("seller_note", shippingForm.seller_note);
                                  }
                                  if (packagePhoto) {
                                    formData.set("package_photo", packagePhoto);
                                  }
                                  if (deliveryReceipt) {
                                    formData.set("delivery_receipt", deliveryReceipt);
                                  }
                                  await uploadShippingProof(publicId, formData, {
                                    accessToken: activeAccessToken,
                                  });
                                })
                              }
                              disabled={pending}
                            >
                              {t("shipping.submit")}
                            </Button>
                          </>
                        ) : currentRole === "buyer" ? (
                          <p className="text-sm text-[var(--ink-soft)]">
                            {t("shipping.awaiting_buyer")}
                          </p>
                        ) : null}
                      </div>
                    </SectionCard>
                  )}

                  {(deal.status === "SHIPPED" ||
                    deal.status === "DISPUTED" ||
                    actionSet.has("confirm_received") ||
                    actionSet.has("open_dispute")) && (
                    <SectionCard title={t("deal.section.dispute")}>
                      {actionSet.has("confirm_received") ? (
                        <div className="mb-4">
                          <Button onClick={() => setConfirmOpen(true)}>
                            {t("deal.action.confirm_received")}
                          </Button>
                        </div>
                      ) : null}
                      {actionSet.has("open_dispute") || deal.status === "DISPUTED" ? (
                        <DisputeForm
                          reason={disputeReason}
                          message={disputeMessage}
                          file={disputeFile}
                          onReasonChange={setDisputeReason}
                          onMessageChange={setDisputeMessage}
                          onFileChange={setDisputeFile}
                          pending={pending}
                          onSubmit={() =>
                            void runAction(async () => {
                              const formData = new FormData();
                              formData.set("reason", disputeReason);
                              formData.set("message", disputeMessage);
                              if (disputeFile) {
                                formData.append("evidence_files", disputeFile);
                              }
                              await openDispute(publicId, formData, {
                                accessToken: activeAccessToken,
                              });
                            })
                          }
                        />
                      ) : null}
                    </SectionCard>
                  )}
                </>
              )}

              <Timeline items={deal.timeline} />
            </div>

            <aside className="space-y-6">
              <SectionCard title={t("deal.section.next_action")}>
                <div className="space-y-3">
                  <Button variant="secondary" className="w-full" onClick={() => void refreshDeal()}>
                    {t("common.retry")}
                  </Button>
                  {activeInviteLink ? <CopyLinkButton value={activeInviteLink} /> : null}
                  {deal.current_user_role === deal.creator_role && activeInviteLink ? (
                    <Link href={activeInviteLink} className="inline-flex text-sm text-[var(--brand)]">
                      <span className="inline-flex items-center gap-2">
                        {t("deal.action.share_link")}
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  ) : null}
                </div>
              </SectionCard>
              <PrimaryActionBar
                primary={
                  actionSet.has("seller_accept") ? (
                    <ActionButton
                      onClick={() =>
                        document
                          .getElementById("seller-accept-section")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      Review &amp; Accept Deal
                    </ActionButton>
                  ) : actionSet.has("upload_payment_proof") ? (
                    <ActionButton
                      onClick={() =>
                        document
                          .getElementById("payment-section")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      {t("deal.action.pay_now")}
                    </ActionButton>
                  ) : actionSet.has("upload_shipping_proof") ? (
                    <ActionButton
                      onClick={() =>
                        document
                          .getElementById("shipping-section")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      {t("deal.action.ship_now")}
                    </ActionButton>
                  ) : actionSet.has("confirm_received") ? (
                    <ActionButton onClick={() => setConfirmOpen(true)}>
                      {t("deal.action.confirm_received")}
                    </ActionButton>
                  ) : undefined
                }
                secondary={
                  actionSet.has("open_dispute") ? (
                    <ActionButton
                      variant="secondary"
                      onClick={() =>
                        document
                          .getElementById("shipping-section")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      {t("deal.action.open_dispute")}
                    </ActionButton>
                  ) : undefined
                }
              />
            </aside>
          </div>
        ) : null}
      </main>

      <ConfirmDialog
        open={confirmOpen}
        title={t("deal.action.confirm_received")}
        description="This moves the deal to payout release pending for admin operations."
        confirmLabel={t("deal.action.confirm_received")}
        cancelLabel={t("common.cancel")}
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          void runAction(async () => {
            await confirmReceived(publicId, {
              accessToken: activeAccessToken,
            });
          })
        }
      />
    </div>
  );
}

function EditTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" className="gap-2 px-2" onClick={onClick}>
      <Pencil className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function EditorCard({
  title,
  children,
  onSave,
  onCancel,
  pending,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <SectionCard title={title}>
      <div className="space-y-4">
        {children}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onSave} disabled={pending}>
            Save
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="text-xs text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}
