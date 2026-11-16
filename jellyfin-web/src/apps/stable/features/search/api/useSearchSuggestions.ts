import type { AxiosRequestConfig } from 'axios';
import type { Api } from '@jellyfin/sdk';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

const fetchGetItems = async (
    api: Api,
    userId: string,
    parentId?: string,
    options?: AxiosRequestConfig
) => {
    const response = await getItemsApi(api).getItems(
        {
            userId,
            sortBy: [ItemSortBy.PlayCount, ItemSortBy.DateCreated, ItemSortBy.SortName, ItemSortBy.Random],
            sortOrder: [SortOrder.Descending],
            includeItemTypes: [
                BaseItemKind.Movie,
                BaseItemKind.Series
            ],
            limit: 24,
            recursive: true,
            imageTypeLimit: 1,
            enableImages: true,
            enableImageTypes: [ImageType.Primary, ImageType.Backdrop],
            fields: [ItemFields.PrimaryImageAspectRatio, ItemFields.Overview],
            parentId,
            enableTotalRecordCount: false
        },
        options
    );
    return response.data.Items || [];
};

export const useSearchSuggestions = (parentId?: string) => {
    const { api, user } = useApi();
    const userId = user?.Id;

    return useQuery({
        queryKey: ['SearchSuggestions', { parentId }],
        queryFn: ({ signal }) =>
            fetchGetItems(api!, userId!, parentId, { signal }),
        refetchOnWindowFocus: false,
        enabled: !!api && !!userId
    });
};
