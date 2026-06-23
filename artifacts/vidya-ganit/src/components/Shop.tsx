import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Coins, Check } from "lucide-react";
import {
  useGetShop,
  getGetShopQueryKey,
  useBuyShopItem,
  useEquipShopItem,
  type ShopItem,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/i18n";

export default function Shop({
  vidyaId,
  onProfileChanged,
}: {
  vidyaId: string;
  onProfileChanged?: () => void;
}) {
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useGetShop(vidyaId, {
    query: { enabled: !!vidyaId, queryKey: getGetShopQueryKey(vidyaId) },
  });
  const buyMutation = useBuyShopItem();
  const equipMutation = useEquipShopItem();

  const coins = data?.coins ?? 0;

  const handleBuy = (item: ShopItem) => {
    if (!vidyaId) return;
    buyMutation.mutate(
      { vidyaId, data: { itemId: item.id } },
      {
        onSuccess: () => {
          refetch();
          onProfileChanged?.();
        },
      },
    );
  };

  const handleEquip = (item: ShopItem, unequip: boolean) => {
    if (!vidyaId) return;
    equipMutation.mutate(
      { vidyaId, data: { kind: item.kind, itemId: unequip ? null : item.id } },
      {
        onSuccess: () => {
          refetch();
          onProfileChanged?.();
        },
      },
    );
  };

  const avatars = (data?.items ?? []).filter((i) => i.kind === "avatar");
  const themes = (data?.items ?? []).filter((i) => i.kind === "theme");

  const renderGroup = (label: string, items: ShopItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
          {label}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => {
            const canAfford = coins >= item.price;
            return (
              <div
                key={item.id}
                data-testid={`card-shop-${item.id}`}
                className={`rounded-2xl border p-4 flex flex-col items-center gap-2 text-center ${
                  item.equipped
                    ? "bg-primary/5 border-primary/30"
                    : "bg-gray-50 border-gray-100"
                }`}
              >
                <span className="text-4xl leading-none">{item.emoji}</span>
                <p className="text-sm font-semibold text-foreground">
                  {item.name}
                </p>
                {!item.owned ? (
                  <>
                    <Badge variant="secondary" className="gap-1 font-bold">
                      <Coins className="w-3.5 h-3.5" />
                      {item.price}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      data-testid={`button-shop-buy-${item.id}`}
                      disabled={!canAfford || buyMutation.isPending}
                      onClick={() => handleBuy(item)}
                      className="w-full rounded-full"
                    >
                      {canAfford ? t("shop.buy") : t("shop.notEnough")}
                    </Button>
                  </>
                ) : item.equipped ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`button-shop-unequip-${item.id}`}
                    disabled={equipMutation.isPending}
                    onClick={() => handleEquip(item, true)}
                    className="w-full rounded-full gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t("shop.unequip")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-testid={`button-shop-equip-${item.id}`}
                    disabled={equipMutation.isPending}
                    onClick={() => handleEquip(item, false)}
                    className="w-full rounded-full"
                  >
                    {t("shop.equip")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-pink-500" />
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {t("shop.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("shop.subtitle")}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="ml-auto text-base font-bold px-3 py-1 gap-1 bg-amber-100 text-amber-700"
            >
              <Coins className="w-4 h-4" />
              {coins}
            </Badge>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("shop.loading")}
            </p>
          ) : (data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("shop.empty")}
            </p>
          ) : (
            <div className="space-y-5">
              {renderGroup(t("shop.kind.avatar"), avatars)}
              {renderGroup(t("shop.kind.theme"), themes)}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
