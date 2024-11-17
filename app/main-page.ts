import { EventData, Page } from '@nativescript/core';
import { MainViewModel } from './view-models/main-view-model';

export function navigatingTo(args: EventData) {
    const page = <Page>args.object;
    if (!page.bindingContext) {
        page.bindingContext = new MainViewModel();
    }
}