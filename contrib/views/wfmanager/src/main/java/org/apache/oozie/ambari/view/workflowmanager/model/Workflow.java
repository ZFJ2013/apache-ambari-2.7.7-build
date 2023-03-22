/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.oozie.ambari.view.workflowmanager.model;

import org.apache.oozie.ambari.view.model.BaseModel;
import org.apache.oozie.ambari.view.model.Indexed;

public class Workflow extends BaseModel implements Indexed {
  private static final long serialVersionUID = 1L;
  private String id = null;
  private String name;
  private String desciption;
  private String workflowDefinitionPath;
  private String type;
  private String isDraft;
  private String definitionMissing;//true or not if path is fine.

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getWorkflowDefinitionPath() {
    return workflowDefinitionPath;
  }

  public void setWorkflowDefinitionPath(String workflowDefinitionPath) {
    this.workflowDefinitionPath = workflowDefinitionPath;
  }

  public String getIsDraft() {
    return isDraft;
  }

  public void setIsDraft(String isDraft) {
    this.isDraft = isDraft;
  }

  public String getDesciption() {
    return desciption;
  }

  public void setDesciption(String desciption) {
    this.desciption = desciption;
  }

  public String getDefinitionMissing() {
    return definitionMissing;
  }

  public void setDefinitionMissing(String definitionMissing) {
    this.definitionMissing = definitionMissing;
  }

}
