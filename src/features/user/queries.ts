import {
  // useMutation,
  useQuery,
  // useQueryClient
} from "@tanstack/react-query";
import api from "@/lib/api";

const getUser = async (): Promise<User> => {
  const { data } = await api.get("/user/me");
  return data;
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ["user"],
    queryFn: getUser,
    retry: false, // Don't retry failed auth requests
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
};
