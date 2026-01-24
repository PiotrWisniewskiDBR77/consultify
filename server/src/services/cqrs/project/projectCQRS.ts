import { CommandBus } from '../CommandBus.js';
import { QueryBus } from '../QueryBus.js';
import { CreateProjectCommand, CreateProjectHandler } from './commands/CreateProjectCommand.js';
import { DeleteProjectCommand, DeleteProjectHandler } from './commands/DeleteProjectCommand.js';
import { UpdateProjectCommand, UpdateProjectHandler } from './commands/UpdateProjectCommand.js';
import { GetProjectHandler, GetProjectQuery } from './queries/GetProjectQuery.js';
import { ListProjectsHandler, ListProjectsQuery } from './queries/ListProjectsQuery.js';

const commandBus = new CommandBus();
commandBus.register(CreateProjectCommand, new CreateProjectHandler());
commandBus.register(UpdateProjectCommand, new UpdateProjectHandler());
commandBus.register(DeleteProjectCommand, new DeleteProjectHandler());

const queryBus = new QueryBus();
queryBus.register(GetProjectQuery, new GetProjectHandler());
queryBus.register(ListProjectsQuery, new ListProjectsHandler());

export { CommandBus, QueryBus };
export const projectCommandBus = commandBus;
export const projectQueryBus = queryBus;
