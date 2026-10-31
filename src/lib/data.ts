import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { errMsg } from "./format";

/** Query wrapper that throws Supabase errors so the UI shows an error state. */
type Res = { data: unknown; error: unknown };
export function useData<T = undefined, R extends Res = Res>(key: QueryKey, fn: () => PromiseLike<R>) {
  // `unknown extends R["data"]` detects an untyped (any) query result from
  // mode-aware builders and passes it through instead of collapsing to {}.
  type Out = T extends undefined ? (unknown extends R["data"] ? R["data"] : NonNullable<R["data"]>) : T;
  return useQuery<Out>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await fn();
      if (error) throw error;
      return data as Out;
    },
  });
}

/** Mutation that only shows success after the backend confirms it. */
export function useAction<V, R = unknown>(
  fn: (v: V) => PromiseLike<{ data: R | null; error: unknown }>,
  opts: { success?: string; invalidate?: QueryKey[]; onDone?: (r: R | null) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { data, error } = await fn(v);
      if (error) throw error;
      return data;
    },
    onSuccess: (r) => {
      if (opts.success) toast.success(opts.success);
      (opts.invalidate ?? [[]]).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      opts.onDone?.(r);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}
